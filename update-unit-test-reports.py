#!/usr/bin/env python3
"""Update the two existing Excel reports from Jest evidence, without re-saving their styles.

Run at repository root: python update-unit-test-reports.py
Requires Python 3.10+, openpyxl, lxml and Node with this repository's TypeScript dependency.
If the desktop's bundled Python is available, it is used automatically when needed.
Only explicit UT identifiers are mapped. Untagged tests never complete a requirement.
Every supported UT gets the same metadata/Condition/Confirm/Result matrix layout.
Only explicit input profiles are rendered. Unknown scenarios stop before originals change.
"""

from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone, timedelta
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap
import zipfile


def load_dependencies():
    try:
        import openpyxl
        import lxml.etree
        return
    except ImportError:
        candidates = [os.environ.get('CODEX_PRIMARY_RUNTIME_PYTHON')]
        candidates.append(str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'))
        for candidate in candidates:
            if candidate and Path(candidate).is_file() and Path(candidate).resolve() != Path(sys.executable).resolve():
                probe = subprocess.run([candidate, '-c', 'import openpyxl,lxml'], capture_output=True)
                if probe.returncode == 0:
                    raise SystemExit(subprocess.call([candidate, '-X', 'utf8', str(Path(__file__).resolve()), *sys.argv[1:]]))
        raise RuntimeError('Install dependencies: python -m pip install openpyxl lxml')


load_dependencies()
from lxml import etree as ET
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter, column_index_from_string, range_boundaries
from openpyxl.utils.datetime import to_excel

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
TAG = '{' + NS['s'] + '}'
TZ = timezone(timedelta(hours=7))

# Parse literal fixtures and expanded it.each rows. This never evaluates test code,
# imports the production service, calls a database or reads credentials/environment files.
NODE_EXTRACTOR = r"""
const fs = require('node:fs'), path = require('node:path'), util = require('node:util');
const ts = require('typescript');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const root = input.root, file = input.file;
const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const constants = new Map();
function fail(message) { throw Error(message); }
function value(n, env = {}) {
  if (!n) return undefined;
  if (ts.isAsExpression(n) || ts.isParenthesizedExpression(n) || ts.isNonNullExpression(n)) return value(n.expression, env);
  if (ts.isStringLiteralLike(n)) return n.text;
  if (ts.isNumericLiteral(n)) return Number(n.text);
  if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (n.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isIdentifier(n)) return Object.hasOwn(env, n.text) ? env[n.text] : value(constants.get(n.text), env);
  if (ts.isArrayLiteralExpression(n)) return n.elements.map(e => value(e, env));
  if (ts.isObjectLiteralExpression(n)) return Object.fromEntries(n.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(source).replace(/^['"]|['"]$/g, ''), value(p.initializer, env)]));
  if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken) return -value(n.operand, env);
  if (ts.isBinaryExpression(n)) {
    const l = value(n.left, env), r = value(n.right, env);
    if (n.operatorToken.kind === ts.SyntaxKind.PlusToken) return l + r;
    if (n.operatorToken.kind === ts.SyntaxKind.MinusToken) return l - r;
    if (n.operatorToken.kind === ts.SyntaxKind.AsteriskToken) return l * r;
  }
  if (ts.isNewExpression(n) && n.expression.getText(source) === 'Date') {
    const v = value(n.arguments[0], env); return typeof v === 'number' ? v : Date.parse(v);
  }
  if (ts.isCallExpression(n) && n.expression.getText(source) === 'NOW.getTime') return value(constants.get('NOW'), env);
  return undefined;
}
function walk(n, fn) { fn(n); ts.forEachChild(n, c => walk(c, fn)); }
walk(source, n => { if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && !constants.has(n.name.text)) constants.set(n.name.text, n.initializer); });
let fixture;
walk(source, n => { if (ts.isFunctionDeclaration(n) && n.name?.text === 'activeUser') { const ret = n.body.statements.find(ts.isReturnStatement); fixture = value(ret?.expression); } });
if (!fixture || fixture.status !== 'ACTIVE' || fixture.failedLoginCount !== 3 || fixture.lockedUntil !== null) fail('UT-001 fixture changed; review the matrix extractor before writing.');
const dto = value(constants.get('dto')), now = value(constants.get('NOW'));
if (!dto || !['email','password','deviceId'].every(k => typeof dto[k] === 'string') || !Number.isFinite(now)) fail('Could not extract login DTO/fake clock.');
const cases = [];
walk(source, n => {
  if (!ts.isCallExpression(n)) return;
  let variants = [[]], title = n.arguments[0], callback = n.arguments[1];
  if (n.expression.getText(source) === 'it') {
    if (!title || !ts.isStringLiteralLike(title)) return;
  } else if (ts.isCallExpression(n.expression) && n.expression.expression.getText(source) === 'it.each') {
    const rows = value(n.expression.arguments[0]);
    if (!Array.isArray(rows)) fail('Nonliteral it.each is not supported.');
    variants = rows.map(row => Array.isArray(row) ? row : [row]);
  } else return;
  if (!ts.isStringLiteralLike(title) || !/UT-001\//.test(title.text)) return;
  if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) fail('Unknown test callback.');
  for (const parameters of variants) {
    const env = Object.fromEntries(callback.parameters.map((p, i) => [p.name.getText(source), parameters[i]]));
    const c = { title: util.format(title.text, ...parameters), sourceLine: source.getLineAndCharacterOfPosition(n.getStart(source)).line + 1,
      found: true, lockedFound: true, hashPresent: fixture.passwordHash != null, compare: true,
      status: fixture.status, failedCount: fixture.failedLoginCount, lockedOffset: null, hashChanged: false,
      dependency: null, httpStatus: null, errorCode: null };
    walk(callback.body, x => {
      if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const lhs = x.left.getText(source), v = value(x.right, env);
        if (lhs === 'locked.lockedUntil') c.lockedOffset = v === null ? null : v - now;
        if (lhs === 'locked.failedLoginCount') c.failedCount = v;
        if (lhs === 'locked.status') c.status = v;
        if (lhs === 'found.passwordHash') c.hashPresent = v != null;
        if (lhs === 'locked.passwordHash' && v !== null && v !== fixture.passwordHash) c.hashChanged = true;
      }
      if (!ts.isCallExpression(x)) return;
      const expr = x.expression.getText(source);
      if (expr === 'comparePassword.mockResolvedValue') c.compare = value(x.arguments[0], env);
      if (expr === 'prisma.user.findUnique.mockResolvedValue') c.found = value(x.arguments[0], env) !== null;
      if (expr === 'tx.user.findUnique.mockResolvedValue') c.lockedFound = value(x.arguments[0], env) !== null;
      if (expr === 'stages[stage].mockRejectedValueOnce') c.dependency = env.stage;
      if (expr === 'expectFailure') { c.httpStatus = value(x.arguments[0], env); c.errorCode = value(x.arguments[1], env); }
    });
    c.category = /UT-001\/([NAB])/.exec(c.title)?.[1] || fail('Missing N/A/B classification.');
    if (c.dependency === 'lookup') c.found = null;
    if (c.dependency === 'password') c.compare = null;
    c.resolves = c.httpStatus === null && c.dependency === null;
    if (![null, -1, 0, 1].includes(c.lockedOffset) || ![0, 3, 4, 5].includes(c.failedCount)) fail('Unrepresented lock/count input.');
    cases.push(c);
  }
});
if (cases.length !== 22 || new Set(cases.map(c => c.title)).size !== cases.length) fail('UT-001 scenario set changed; review matrix capacity and rows.');
const targets = {
  'services/auth-service/src/modules/auth/auth.service.ts': ['AuthService.login','AuthService.issueTokens','AuthService.refresh'],
  'services/auth-service/src/modules/auth/auth.controller.ts': ['AuthController.login'],
  'services/auth-service/src/modules/users/user-presenter.ts': ['UserPresenter.present'],
  'services/auth-service/src/identity.ts': ['lockedUser','tokenHash','failure'],
  'services/auth-service/src/http.ts': ['ContractPipe.transform'],
};
const functions = [];
for (const [relative, names] of Object.entries(targets)) {
  const f = ts.createSourceFile(relative, fs.readFileSync(path.join(root, relative), 'utf8'), ts.ScriptTarget.Latest, true);
  walk(f, n => {
    let name;
    if (ts.isFunctionDeclaration(n) && n.name) name = n.name.text;
    if (ts.isMethodDeclaration(n) && n.name && ts.isClassDeclaration(n.parent)) name = `${n.parent.name.text}.${n.name.getText(f)}`;
    if (!names.includes(name)) return;
    const start = f.getLineAndCharacterOfPosition(n.getStart(f)).line + 1, end = f.getLineAndCharacterOfPosition(n.end).line + 1;
    functions.push({file:relative,name,start,end,loc:end-start+1,signature:`${name}(${n.parameters.map(p=>p.getText(f).replace(/\s+/g,' ')).join(', ')})`});
  });
}
if (functions.length !== 9) fail('A traced production function could not be located.');
console.log(JSON.stringify({cases, functions, inputs:{email:dto.email, deviceId:dto.deviceId,password:'[fixture redacted]'},now:new Date(now).toISOString()}));
"""


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def workbook_path(root: Path, value: str) -> Path:
    path = (root / value).resolve()
    if not path.is_relative_to(root) or path.suffix.lower() != '.xlsx':
        raise ValueError(f'Workbook must be an .xlsx inside the repository: {path}')
    for parent in [path, *path.parents]:
        if parent == root.parent:
            break
        if parent.is_symlink() or getattr(parent, 'is_junction', lambda: False)():
            raise ValueError(f'Reparse point is not a valid workbook target: {parent}')
    return path


def sheet_parts(data: bytes) -> dict[str, str]:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        wb = ET.fromstring(z.read('xl/workbook.xml'))
        rel = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        result = {}
        for sheet in wb.find('s:sheets', NS):
            target = rel[sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
            result[sheet.get('name')] = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        return result


def managed_merge(reference, start, end, column_limit=27):
    left, top, right, bottom = range_boundaries(reference)
    return left >= 1 and right <= column_limit and top >= start and bottom <= end


def patch_sheet(data: bytes, values: dict, caches: dict, heights: dict, styles: dict, widths=None, merges=None, merge_from=None, merge_until=None, merge_columns=27) -> bytes:
    tree = ET.fromstring(data)
    sd = tree.find('s:sheetData', NS)
    rows = {int(r.get('r')): r for r in sd}
    cells = {c.get('r'): c for r in sd for c in r if c.tag == TAG + 'c'}
    reference_styles = {address:cells[reference].get('s') for address,reference in styles.items() if reference in cells}

    def cell(address):
        if address in cells:
            return cells[address]
        row_number = int(re.search(r'\d+$', address).group())
        if row_number not in rows:
            row = ET.Element(TAG + 'row', r=str(row_number))
            sd.insert(sum(int(r.get('r')) < row_number for r in sd), row)
            rows[row_number] = row
        row = rows[row_number]
        new = ET.Element(TAG + 'c', r=address)
        style_source = styles.get(address)
        if style_source in cells and 's' in cells[style_source].attrib:
            new.set('s', cells[style_source].get('s'))
        col = column_index_from_string(re.sub(r'\d+$', '', address))
        row.insert(sum(column_index_from_string(re.sub(r'\d+$', '', c.get('r'))) < col for c in row if c.tag == TAG + 'c'), new)
        cells[address] = new
        return new

    for address, value in values.items():
        c = cell(address)
        for child in list(c):
            if child.tag in {TAG + 'f', TAG + 'v', TAG + 'is'}:
                c.remove(child)
        c.attrib.pop('t', None)
        if value is None:
            continue
        if isinstance(value,dict) and 'formula' in value:
            ET.SubElement(c,TAG+'f').text=value['formula'].lstrip('=')
            ET.SubElement(c,TAG+'v').text=str(value['cached'])
        elif isinstance(value, (int, float)):
            ET.SubElement(c, TAG + 'v').text = str(value)
        else:
            if len(str(value)) > 32767:
                raise ValueError(f'Cell text exceeds Excel limit: {address}')
            c.set('t', 'inlineStr')
            t = ET.SubElement(ET.SubElement(c, TAG + 'is'), TAG + 't')
            t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
            t.text = str(value)
    for address, value in caches.items():
        c = cell(address)
        if c.find('s:f', NS) is None:
            raise ValueError(f'Expected an existing formula in {address}')
        c.attrib.pop('t', None)
        v = c.find('s:v', NS)
        if v is None:
            v = ET.SubElement(c, TAG + 'v')
        v.text = str(value)
    for address, reference in styles.items():
        target = cell(address)
        if reference_styles.get(address) is not None:
            target.set('s', reference_styles[address])
        else:
            target.attrib.pop('s', None)
    if widths:
        cols = tree.find('s:cols', NS)
        if cols is None:
            raise ValueError('Expected the template column definitions.')
        for old in list(cols):
            start, end = int(old.get('min')), int(old.get('max'))
            affected = sorted(c for c in widths if start <= c <= end)
            if not affected:
                continue
            cols.remove(old)
            cursor = start
            for c in affected:
                if cursor < c:
                    part = deepcopy(old)
                    part.set('min', str(cursor)); part.set('max', str(c-1))
                    cols.append(part)
                part = deepcopy(old)
                part.set('min', str(c)); part.set('max', str(c))
                part.set('width', str(widths[c])); part.set('customWidth', '1')
                part.attrib.pop('bestFit', None)
                cols.append(part)
                cursor = c+1
            if cursor <= end:
                part = deepcopy(old)
                part.set('min', str(cursor)); part.set('max', str(end))
                cols.append(part)
        cols[:] = sorted(cols, key=lambda c:int(c.get('min')))
    for number, height in heights.items():
        rows[number].set('ht', str(height))
        rows[number].set('customHeight', '1')
    if merge_from is not None:
        merged = tree.find('s:mergeCells', NS)
        if merged is None:
            raise ValueError('Expected the original template merge definitions.')
        for item in list(merged):
            if managed_merge(item.get('ref'),merge_from,merge_until,merge_columns):
                merged.remove(item)
        for reference in merges or []:
            ET.SubElement(merged, TAG+'mergeCell', ref=reference)
        merged.set('count', str(len(merged)))
    dimension = tree.find('s:dimension', NS)
    if dimension is not None:
        last_col = max(column_index_from_string(re.sub(r'\d+$', '', a)) for a in cells)
        last_row = max(int(re.search(r'\d+$', a).group()) for a in cells)
        dimension.set('ref', f'A1:{get_column_letter(last_col)}{last_row}')
    return ET.tostring(tree, xml_declaration=data.startswith(b'<?xml'), encoding='UTF-8', standalone=True)


def rewrite(data: bytes, changes: dict) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(data)) as src, zipfile.ZipFile(output, 'w') as dst:
        for item in src.infolist():
            content = src.read(item.filename)
            if item.filename in changes:
                content = patch_sheet(content, **changes[item.filename])
            dst.writestr(item, content)
    return output.getvalue()


def verify_preservation(before: bytes, after: bytes, changes: dict):
    with zipfile.ZipFile(io.BytesIO(before)) as old, zipfile.ZipFile(io.BytesIO(after)) as new:
        if old.namelist() != new.namelist() or new.testzip():
            raise ValueError('Workbook ZIP structure changed or became corrupt.')
        for entry in old.namelist():
            if entry not in changes:
                if old.read(entry) != new.read(entry):
                    raise ValueError(f'Unrelated workbook part changed: {entry}')
                continue
            a, b = ET.fromstring(old.read(entry)), ET.fromstring(new.read(entry))
            original_rows = {r.get('r') for r in a.findall('s:sheetData/s:row',NS)}
            before_cells={c.get('r'):c for c in a.findall('.//s:sheetData/s:row/s:c',NS)}
            after_cells={c.get('r'):c for c in b.findall('.//s:sheetData/s:row/s:c',NS)}
            for tree in (a, b):
                for c in tree.findall('.//s:sheetData/s:row/s:c', NS):
                    if c.get('r') in changes[entry]['values'] or c.get('r') in changes[entry]['caches']:
                        # Preserve every existing cell style, even when its value changes.
                        original = before_cells.get(c.get('r'))
                        updated = after_cells.get(c.get('r'))
                        if original is not None and updated is not None and original.get('s') != updated.get('s') and c.get('r') not in changes[entry]['styles']:
                            raise ValueError(f'Existing cell style changed: {c.get("r")}')
            # Only the filled matrix cells may reuse reference styles; all other style
            # records and workbook parts remain byte-for-byte identical.
            for address, reference in changes[entry]['styles'].items():
                expected = before_cells.get(reference)
                actual = after_cells.get(address)
                if actual is None or expected is None or actual.get('s') != expected.get('s'):
                    raise ValueError(f'Incorrect copied matrix style: {address}')
            if changes[entry].get('widths'):
                def column_map(tree):
                    result = {}
                    for col in tree.findall('s:cols/s:col', NS):
                        attrs = {k:v for k,v in col.attrib.items() if k not in ('min','max')}
                        result.update({i:attrs for i in range(int(col.get('min')),int(col.get('max'))+1)})
                    return result
                old_cols, new_cols = column_map(a), column_map(b)
                for number in old_cols.keys() | new_cols.keys():
                    old_attrs, new_attrs = old_cols.get(number,{}), new_cols.get(number,{})
                    if number in changes[entry]['widths']:
                        old_attrs={k:v for k,v in old_attrs.items() if k not in ('width','customWidth','bestFit')}
                        new_attrs={k:v for k,v in new_attrs.items() if k not in ('width','customWidth','bestFit')}
                    if old_attrs != new_attrs:
                        raise ValueError(f'Unrelated column formatting changed: {number}')
                for tree in (a,b):
                    tree.remove(tree.find('s:cols',NS))
            # Remove only authorized cell payloads and row heights for semantic comparison.
            for tree in (a, b):
                if changes[entry].get('merge_from') is not None:
                    merged = tree.find('s:mergeCells',NS)
                    for item in list(merged):
                        if managed_merge(item.get('ref'),changes[entry]['merge_from'],changes[entry]['merge_until'],changes[entry].get('merge_columns',27)):
                            merged.remove(item)
                    merged.set('count',str(len(merged)))
                for row in tree.findall('s:sheetData/s:row', NS):
                    if int(row.get('r')) in changes[entry]['heights']:
                        row.attrib.pop('ht', None)
                        row.attrib.pop('customHeight', None)
                    row.attrib.pop('spans', None)
                    for c in list(row):
                        if c.get('r') in changes[entry]['values']:
                            row.remove(c)
                        elif c.get('r') in changes[entry]['caches']:
                            for v in c.findall('s:v', NS):
                                c.remove(v)
                    if row.get('r') not in original_rows and len(row)==0:
                        row.getparent().remove(row)
                dim = tree.find('s:dimension', NS)
                if dim is not None:
                    tree.remove(dim)
            if ET.tostring(a, method='c14n') != ET.tostring(b, method='c14n'):
                raise ValueError(f'Formatting, formulas or unrelated cells changed in {entry}')


def branch_coverage(coverage: dict, functions=None) -> dict:
    total = covered = 0
    for filename, item in coverage.items():
        normalized = filename.replace('\\', '/')
        ranges = [f for f in (functions or []) if normalized.endswith('/' + f['file'])]
        if functions is not None and not ranges:
            continue
        for key, counts in item.get('b', {}).items():
            loc = item['branchMap'][key]['loc']
            if functions is not None and not any(loc['start']['line'] >= f['start'] and loc['end']['line'] <= f['end'] for f in ranges):
                continue
            total += len(counts)
            covered += sum(count > 0 for count in counts)
    # Match Istanbul/Jest: percentages are truncated to two decimal places.
    return {'covered': covered, 'total': total, 'pct': (covered * 10000 // total) / 100 if total else None}


DETAIL_TITLE = 'KẾT QUẢ JEST THEO MÃ UT'
MATRIX_TITLE = 'MA TRẬN UNIT TEST (TỰ ĐỘNG)'
MATRIX_END = 'KẾT THÚC MA TRẬN TỰ ĐỘNG'

# Evaluate only whitelisted data expressions, never imports, test bodies or services.
# This expands the actual .map/.flatMap fixtures, including undefined versus missing.
NODE_CONTRACT_INPUTS = r"""
const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),Ajv=require('ajv');
const emailValidator=new Ajv({allErrors:true}).compile(require('./packages/contracts/p0/schemas/domain.schema.json').definitions.LoginRequest.properties.email);
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const sf=ts.createSourceFile(input.file,fs.readFileSync(input.file,'utf8'),ts.ScriptTarget.Latest,true);
const declarations=[];
for(const statement of sf.statements) if(ts.isVariableStatement(statement)) {
  const names=statement.declarationList.declarations.map(d=>d.name.getText(sf));
  if(names.some(n=>['valid','missing','invalid'].includes(n))) declarations.push(statement.getText(sf));
}
function check(node) {
  if(ts.isCallExpression(node)) {
    const allowed=ts.isIdentifier(node.expression)?node.expression.text==='missing':
      ts.isPropertyAccessExpression(node.expression)&&['map','flatMap','repeat','freeze'].includes(node.expression.name.text);
    if(!allowed) throw Error('Unsupported data expression: '+node.expression.getText(sf));
  }
  if(ts.isNewExpression(node)||ts.isImportDeclaration(node)||ts.isAwaitExpression(node)) throw Error('Unsafe data expression');
  ts.forEachChild(node,check);
}
function evaluate(expression,row={}) {
  const code=declarations.join('\n')+'\nconst {password,label,name,input}=__row;__out=('+expression+');';
  const tree=ts.createSourceFile('data.ts',code,ts.ScriptTarget.Latest,true);check(tree);
  const context={__row:row};
  vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context,{timeout:1000});
  return context.__out;
}
const kind=v=>v===null?'null':Array.isArray(v)?'array':typeof v;
function describe(v) {
  const out={'Body':kind(v)};
  if(kind(v)!=='object') return out;
  for(const key of ['email','password','deviceId']) {
    let type=Object.hasOwn(v,key)?kind(v[key]):'missing';
    if(key==='password'&&type==='object'&&Object.hasOwn(v[key],'passwordHash'))type='obj/hash';
    out[key+'.type']=type;
    if(type!=='string')continue;
    const text=v[key];
    if(key==='email') {
      const normalized=text.trim().toLowerCase();
      out['email.class']=normalized.length>320?'>320ch':!normalized?'empty':!emailValidator(normalized)?'invalid':normalized!==text?'normalize':'valid';
    } else if(key==='password') {
      const bytes=Buffer.byteLength(text,'utf8');
      out['password.len']=!text?'empty':text.length>72?'>72ch':bytes>72?'>72B':`${bytes}B/${text.length}ch`;
    } else out['deviceId.len']=!text?'empty':text.length>255?'>255ch':text.length===255?'255ch':'normal';
  }
  out.Extra=Object.keys(v).filter(k=>!['email','password','deviceId'].includes(k)).join(',')||'none';
  return out;
}
const cases=[];
function walk(n) {
  if(ts.isCallExpression(n)) {
    let rows=[{}],title=n.arguments[0],callback=n.arguments[1];
    const plain=n.expression.getText(sf)==='it';
    const each=ts.isCallExpression(n.expression)&&n.expression.expression.getText(sf)==='it.each';
    if(plain||each) {
      if(each)rows=evaluate(n.expression.arguments[0].getText(sf));
      if(!title||!ts.isStringLiteralLike(title)||!callback)throw Error('Unsupported test declaration');
      let initializer;
      function find(x){if(ts.isVariableDeclaration(x)&&x.name.getText(sf)==='input')initializer=x.initializer;ts.forEachChild(x,find);}
      find(callback.body);
      for(const row of rows) {
        const expanded=title.text.replace(/\$(\w+)/g,(_,key)=>String(row[key]));
        const body=initializer?evaluate(initializer.getText(sf),row):row.input;
        cases.push({title:expanded,vector:describe(body)});
      }
      return;
    }
  }
  ts.forEachChild(n,walk);
}
walk(sf);console.log(JSON.stringify(cases));
"""


GROUP2 = ('UT-006','UT-007','UT-008','UT-009','UT-010')
GROUP3 = ('UT-011','UT-012','UT-013','UT-014','UT-015','UT-023')
GROUP4 = ('UT-016','UT-017')
GROUP5 = ('UT-018','UT-019','UT-020')
GROUP6 = ('UT-021','UT-022','UT-024')
GROUP6_TRACE = r"""
const fs=require('node:fs'),ts=require('typescript');
const file='services/exam-service/src/modules/attempts/attempt-view.ts';
const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
const out=[];
function walk(n) {
 let name;
 if(ts.isFunctionDeclaration(n)&&n.name?.text==='attemptView')name='attemptView';
 if(ts.isArrowFunction(n)&&ts.isVariableDeclaration(n.parent)&&n.parent.name.getText(sf)==='url')name='attemptView.url';
 if(name) {
  const start=sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
  const end=sf.getLineAndCharacterOfPosition(n.end).line+1;
  out.push({file,name,start,end,loc:end-start+1,
   signature:name+'('+n.parameters.map(p=>p.getText(sf).replace(/\s+/g,' ')).join(', ')+')'});
 }
 ts.forEachChild(n,walk);
}walk(sf);
if(out.length!==2)throw Error('Missing Group 6 presenter or URL function');
console.log(JSON.stringify(out));
"""
GROUP2_TRACE = r"""
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const targets={
 'services/auth-service/src/modules/auth/auth.service.ts':['AuthService.logout'],
 'services/auth-service/src/modules/auth/auth.controller.ts':['AuthController.logout'],
 'services/exam-service/src/modules/attempts/attempts.service.ts':[
  'AttemptsService.record','AttemptsService.owner','AttemptsService.editable','AttemptsService.lock',
  'AttemptsService.validateChoices','AttemptsService.saveDraft','AttemptsService.saveAnswer','AttemptsService.submit',
  'AttemptsService.getResult','AttemptsService.finalize'],
 'services/exam-service/src/modules/attempts/attempts.controller.ts':[
  'AttemptsController.saveAnswer','AttemptsController.draft','AttemptsController.submit','AttemptsController.result'],
 'services/exam-service/src/modules/attempts/draft.store.ts':[
  'DraftStore.key','DraftStore.call','DraftStore.read','DraftStore.write'],
};
const out=[];
for(const [file,names] of Object.entries(targets)) {
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 function walk(n){
  if(ts.isMethodDeclaration(n)&&ts.isClassDeclaration(n.parent)) {
   const name=n.parent.name.text+'.'+n.name.getText(source);
   if(names.includes(name)) {
    const start=source.getLineAndCharacterOfPosition(n.getStart(source)).line+1;
    const end=source.getLineAndCharacterOfPosition(n.end).line+1;
    out.push({file,name,start,end,loc:end-start+1,signature:name+'('+n.parameters.map(p=>p.getText(source).replace(/\s+/g,' ')).join(', ')+')'});
   }
  }
  ts.forEachChild(n,walk);
 }walk(source);
 if(names.some(n=>!out.some(f=>f.file===file&&f.name===n)))throw Error('Production function missing: '+file);
}
console.log(JSON.stringify(out));
"""

GROUP4_TRACE = r"""
const fs=require('node:fs'),ts=require('typescript');
const targets={
 'services/exam-service/src/scoring/scoring.service.ts':
  ['partStats','ScoringService.constructor','ScoringService.provenance','ScoringService.full'],
 'services/exam-service/src/scoring/ets-score-table.ts':
  ['loadEtsScoreTable','validateEtsScoreTable','lookupEtsScore'],
};
const out=[];
for(const [file,names] of Object.entries(targets)) {
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 function walk(n) {
  let name;
  if(ts.isFunctionDeclaration(n)&&n.name)name=n.name.text;
  if(ts.isMethodDeclaration(n)&&ts.isClassDeclaration(n.parent))name=n.parent.name.text+'.'+n.name.getText(source);
  if(ts.isConstructorDeclaration(n))name=n.parent.name.text+'.constructor';
  if(names.includes(name)) {
   const start=source.getLineAndCharacterOfPosition(n.getStart(source)).line+1;
   const end=source.getLineAndCharacterOfPosition(n.end).line+1;
   out.push({file,name,start,end,loc:end-start+1,
    signature:name+'('+n.parameters.map(p=>p.getText(source).replace(/\s+/g,' ')).join(', ')+')'});
  }
  ts.forEachChild(n,walk);
 }walk(source);
 if(names.some(name=>!out.some(f=>f.file===file&&f.name===name)))throw Error('Missing Group 4 function: '+file);
}
console.log(JSON.stringify(out));
"""


def group2_vector(key, c, suite, assertion):
    """Profiles are the literal JSON records consumed by the executed it.each tests.

    Defaults below describe createAuthHarness/createAttemptHarness, not login inputs
    copied onto exam requirements. Exact titles/dataset cardinality are checked first.
    """
    vector={}; confirms={}; resolves=False; http=c.get('http'); code=None
    if key in ('UT-006','UT-007'):
        vector={'Lookup':c.get('lookup','found'),'User':c.get('user',c.get('userStatus','ACTIVE')),
                'Session':c.get('session','owned/active'),'Dependency':c.get('dependency','none'),'Clock':'fixed'}
    if key=='UT-006':
        vector.update({'Binding':c.get('binding','set'),'Session TTL':str(c.get('sessionOffset',60000))+'ms',
                       'Refresh':c.get('token','active'),'Refresh TTL':str(c.get('tokenOffset',45000))+'ms',
                       'Consume rows':str(c.get('consumeRows',1))})
        http='ERR' if c.get('dependency') else c.get('http',401)
        code='DEP' if c.get('dependency') else 'NF' if http==404 else 'RT'
        confirms={'No token pair':True,'No renewal':True,'State intact':True}
    elif key=='UT-007':
        resolves=not c.get('http') and not c.get('dependency')
        http='ERR' if c.get('dependency') else http
        code='DEP' if c.get('dependency') else 'NF' if http==404 else 'RT' if http else None
        confirms={'Target revoked':resolves and not c.get('session'),'Other intact':True,'Invalidated':resolves}
    else:
        option='missing' if c.get('missing') else 'null' if c.get('option') is None and 'option' in c else json.dumps(c.get('option','B'),ensure_ascii=False)
        vector={'Entry':c['entry'],'Snapshot':c.get('snapshot','Part2/25 A B C'),
                'Owner':c.get('owner','same'),'Status':c.get('status','IN_PROGRESS'),
                'Version':str(c.get('snapshotVersion',1)),'Deadline':str(c.get('deadlineOffset',60000))+'ms',
                'Question':c.get('question','local'),'Option':option,
                'Batch':c.get('answers','mixed' if c.get('mixed') else 'duplicate' if c.get('duplicate') else 'one'),
                'Dependency':c.get('dependency','none')}
        if c.get('answers')=='two':vector.update(Question='Q1/Q2',Option='B/C')
        if c.get('answers')=='empty' or c['entry']=='submit-default':vector.update(Question='none',Option='none',Batch='zero')
        if c['entry']=='replace':vector['Option']='B -> C'
        if c['entry']=='result':vector.update(Question='N/A',Option='N/A',Batch='N/A')
        if c.get('mixed'):vector.update(Question='local+foreign' if key=='UT-010' else 'Q2/Q1',Option='B/D' if key=='UT-009' else 'B/B')
        if c.get('duplicate'):vector['Question']='Q1 repeated'
        if key=='UT-008':
            resolves=not c.get('http')
            expired=c.get('deadlineOffset',60000)<=0 and not c.get('dependency')
            code='EXP' if expired else 'DEP' if http else None
            confirms={'Draft stored':resolves,'No final write':not expired,'Expired':expired}
        elif key=='UT-009':
            http=400;dto=c['entry'].startswith('dto-') and c['entry']!='dto-then-save'
            code='VAL' if dto else 'DUP' if c.get('duplicate') else 'OPT'
            confirms={'No draft':True,'No final write':True,'DTO blocks':dto}
        else:
            vector.update({'Record':c.get('record','found'),'Row lock':c.get('lock','found')})
            resolves=bool(c.get('outcome'))
            http=None if resolves else c.get('http',400)
            code=None if resolves else {400:'SN',403:'OW',404:'NF',409:'ST'}[http]
            confirms={'No draft':True,'No final write':c.get('outcome')!='finalized','Snapshots intact':True}
    return {'title':c['name'],'vector':vector,'category':c['category'],'resolves':resolves,
            'http':http,'code':code,'confirms':confirms,'status':assertion['status'],'executedAt':suite.get('endTime')}


def group3_vector(key, c, suite, assertion):
    """Mirror the executed group3-cases.json inputs; output flags are asserted in Jest."""
    entry=c['entry']; mutation=entry in ('single','draft')
    vector={'Entry':entry,'Snapshot':'Part2/25 A B C','Owner':'A calls own',
            'Status':c.get('status','IN_PROGRESS'),'Version':'1',
            'Clock':'D'+f"{c['clockOffset']:+d}"+'ms' if 'clockOffset' in c else 'D-60000ms',
            'Initial draft':'Q1=A Q2=A'}
    resolves=True;http=None;code=None;confirms={}
    if key=='UT-011':
        vector.update({'Question IDs':','.join('Q'+str(n) for n in c['questions']),
                       'Options':'A/null' if c.get('unique') else 'B/C/B','DTO':'nested pipe'})
        resolves=bool(c.get('unique'));http=None if resolves else 400;code=None if resolves else 'DUP'
        confirms={'No partial I/O':not resolves,'Draft stored':resolves and entry=='draft',
                  'Finalized once':resolves and entry=='submit'}
    elif key=='UT-012':
        vector.update({'Sequence':'A -> B -> null','Storage':c['storage'],'DTO':'B/null pipe',
                       'Submit body':'omitted'})
        confirms={'B then null':True,'Q2 intact':True,'Null incorrect':True}
    elif key=='UT-013':
        expired=c['clockOffset']>=0 or c.get('readCrossesDeadline',False)
        failure=c.get('readFailure',False)
        vector.update({'New choice':'none' if entry=='result' else 'B',
                       'Draft read':'503' if failure else 'cross deadline' if c.get('readCrossesDeadline') else 'ready'})
        resolves=not failure and not (expired and mutation)
        http=503 if failure else 409 if not resolves else None
        code='DEP' if failure else 'EXP' if not resolves else None
        confirms={'B saved':not expired and mutation,'Old draft used':expired and not failure,
                  'No final DB':failure or (not expired and entry!='submit')}
    elif key=='UT-014':
        vector.update({'New choice':'none' if entry=='result' else 'null','Completed':'finalize first'})
        if c['status']=='EXPIRED':vector['Clock']='D+0ms'
        resolves=not mutation;http=None if resolves else 409;code=None if resolves else 'ST'
        confirms={'Result intact':True,'No draft I/O':True,'No final DB':True}
    elif key=='UT-015':
        vector['Owner']='B calls A'
        resolves=False;http=403;code='OW'
        confirms={'No private data':True,'No draft/DB':True,'Record read':True}
    elif key=='UT-023':
        vector.update({'Fault':c['fault'],'New choice':'B','Storage':'Store/Redis mock' if c['fault'].startswith('redis-') else 'draft mock'})
        resolves=False
        http='ERR' if c['fault']=='error' else 409 if c['fault'] in ('conflict','redis-deadline') else 503
        code='EXP' if http==409 else 'DEP'
        confirms={'No save ack':True,'Draft intact':True,'No final DB':True}
    else:raise ValueError(f'Unknown Group 3 requirement: {key}')
    return {'title':c['name'],'vector':vector,'category':c['category'],'resolves':resolves,
            'http':http,'code':code,'confirms':confirms,'status':assertion['status'],'executedAt':suite.get('endTime')}


def group4_vector(key, c, suite, assertion):
    """Use the exact Group 4 profile executed by Jest, including pinned expectations."""
    kind=c['kind'];vector={'Function':kind};resolves=True;error=None;code=None
    confirms={'Stats exact':False,'Input intact':False,'No phantom Part':False} if key=='UT-016' else {
        'L/R/total exact':False,'Fail closed':False,'Mode contract':False}
    if key=='UT-016':
        questions=c['questions'];choices=dict(c['choices'])
        states=[]
        for question_id,part,answer in questions:
            state='missing' if question_id not in choices else 'null' if choices[question_id] is None else 'correct' if choices[question_id]==answer else 'wrong'
            if state not in states:states.append(state)
        vector.update({'Questions':str(len(questions)),'Input order':'sorted' if [q[1] for q in questions]==sorted(q[1] for q in questions) else 'unsorted',
                       'Foreign choices':str(len(set(choices)-{q[0] for q in questions}))})
        for state in ('correct','wrong','null','missing'):vector[state]='yes' if state in states else 'no'
        for part,skill,total,correct,accuracy in c['expected']:
            vector[f'P{part} c/t']=f'{correct}/{total}'
            vector[f'P{part} skill']='L' if skill=='LISTENING' else 'R'
            vector[f'P{part} ratio']='1/3' if accuracy==1/3 else str(accuracy)
        confirms.update({'Stats exact':True,'Input intact':True,'No phantom Part':not questions})
    elif kind in ('full','finalize'):
        vector.update({'Mode':c.get('mode','FULL'),'L raw':str(c['raw'][0]),'R raw':str(c['raw'][1])})
        for i,correct in enumerate(c['correctByPart'],1):vector[f'P{i} correct']=str(correct)
        for label,value in zip(('Expected L','Expected R','Expected total'),c['expected']):
            vector[label]=str(value) if c.get('mode')!='PART' else 'null'
        confirms['L/R/total exact']=c.get('mode')!='PART'
        confirms['Mode contract']=kind=='finalize'
    elif kind=='sweep':
        vector.update({'L raw':'0..100','R raw':'0..100','Oracle':'202 cells','Version':'2026.10-sample'})
        confirms['L/R/total exact']=True
    elif kind=='invalid-raw':
        vector.update({'Raw':str(c['raw']),'Skill':'both'})
        resolves=False;error='ERR';code='RAW';confirms['Fail closed']=True
    elif kind=='invalid-table':
        vector.update({'Table defect':c['mutation'],'Label':'custom/default'})
        resolves=False;error='ERR';code='TBL';confirms['Fail closed']=True
    elif kind=='fallback':
        vector.update({'File read':'throws','Policy':c['policy']})
        # The dev case returns a formula table, then proves provenance rejects it.
        resolves=c['policy']=='development';error='503' if resolves else 'ERR';code='PV' if resolves else 'IO'
        confirms['Fail closed']=True;confirms['Mode contract']=resolves
    elif kind=='provenance':
        vector['Version defect']=c['mutation']
        resolves=False;error='503';code='PV';confirms['Fail closed']=True
    else:raise ValueError(f'Unknown Group 4 profile kind: {kind}')
    return {'title':c['name'],'vector':vector,'category':c['category'],'resolves':resolves,
            'http':error,'code':code,'confirms':confirms,'status':assertion['status'],'executedAt':suite.get('endTime')}


def group5_vector(key, c, suite, assertion):
    """Map submit fixture inputs and independently stated expectations, not login fields."""
    mode=c['mode'];body=c['body'];failure=c.get('readFailure',False)
    vector={'Mode':mode,'Entry':c['entry'],'Body':body,
        'Snapshot':'7 Parts/200' if mode=='FULL' else 'Part2/25',
        'Draft':'empty' if c.get('emptyDraft') else '1R 2W 3Z',
        'Reading draft':'101R' if mode=='FULL' and not c.get('emptyDraft') else 'none',
        'Read failure':'503' if failure else 'none'}
    if key=='UT-018':
        vector['Clock']='D-60000ms'
        vector['Body choices']='1Z 2R 4R' if body=='merge' else 'none'
        confirms={'Choices exact':not failure,'Writes match':True,'Draft intact':True}
    elif key=='UT-019':
        vector.update({'Clock':f"D{c['clockOffset']:+d}ms",'Read crosses D':'yes' if c['readCrossesDeadline'] else 'no',
                       'Body choices':'1W 2R 3R 4R','Body accepted':'no' if c['expired'] else 'yes'})
        confirms={'Choices exact':True,'Deadline intact':True,'Writes once':True}
    elif key=='UT-020':
        vector.update({'First status':c['status'],'Repeat clock':'now+120000ms',
                       'Body choices':'1W 2R 3R 4R' if body=='changed' else 'none',
                       'Repeat lookup':'1 tx/lock/read','Repeat draft':'0 read/write','Repeat grading':'0 calls'})
        confirms={'Result intact':True,'No regrade':True,'No writes':True}
    else:raise ValueError(f'Unknown Group 5 requirement: {key}')
    if not failure:
        vector['Correct count']=str(c['expectedCorrect'])
        for i,count in enumerate(c['expectedCounts']):vector[f'P{i+1 if mode=="FULL" else 2} correct']=str(count)
        vector['Final status']=c['status'] if key=='UT-020' else 'EXPIRED' if c.get('expired') else 'SUBMITTED'
        vector['Full score']='10' if mode=='FULL' else 'null'
    return {'title':c['name'],'vector':vector,'category':c['category'],'resolves':not failure,
            'http':503 if failure else None,'code':'RD' if failure else None,'confirms':confirms,
            'status':assertion['status'],'executedAt':suite.get('endTime')}


def group6_vector(key, c, suite, assertion):
    """Presenter/privacy/clock inputs are the exact executed Group 6 profiles."""
    vector={'Function':'attemptView','Mode':c['mode'],'Status':c['status'],
            'Snapshot':'7 Parts/200' if c['mode']=='FULL' else 'Parts3,5/69',
            'Clock':'D+1ms' if c['status']=='EXPIRED' else 'D-60000ms'}
    if key=='UT-021':
        vector.update({'Drafts':c['drafts'],'Private question':'K/E/T',
                       'Private group':'transcript','Published scores':'null','Full-only keys':'absent'})
        confirms={'No secrets':True,'Draft/content':True,'Input intact':True}
    elif key=='UT-022':
        vector.update({'Base suffix':'slash' if c['trailingSlash'] else 'no slash',
                       'Media':'encoded/null','Assets':'key/null/list',
                       'Final choices':'3R 1W Z/B' if c['mode']=='FULL' else '2R 1W Z/B',
                       'Conflicting drafts':'ignored','Full score':'5/5/10' if c['mode']=='FULL' else 'null',
                       'Final stats':'3/200' if c['mode']=='FULL' else '2/69'})
        confirms={'Result exact':True,'Media/groups':True,'Input intact':True}
    elif key=='UT-024':
        sequence=c['kind']=='sequence'
        clock='\n'.join(','.join(map(str,values)) for values in [c['offsets'][:2],c['offsets'][2:5],c['offsets'][5:]])+'ms' if sequence else f"D{c['offset']:+d}ms"
        remaining='\n'.join(','.join(map(str,values)) for values in [c['expectedSequence'][:4],c['expectedSequence'][4:]]) if sequence else str(c['expectedRemaining'])
        vector.update({'Kind':c['kind'],'Clock':clock,'Remaining':remaining,
                       'Rule':'ceil+clamp','Deadline':'fixed'})
        confirms={'Time exact':True,'Deadline intact':True,'Input intact':True}
    else:raise ValueError(f'Unknown Group 6 requirement: {key}')
    return {'title':c['name'],'vector':vector,'category':c['category'],'resolves':True,
            'http':None,'code':None,'confirms':confirms,'status':assertion['status'],
            'executedAt':suite.get('endTime')}


def scenario_vectors(case_id, assertions, contract_inputs):
    """Explicit adapters: a new/renamed scenario fails instead of inventing inputs.

    Future UTs add an adapter here; the matrix layout renderer is shared by all UTs.
    """
    dataset='group6' if case_id in GROUP6 else 'group5' if case_id in GROUP5 else 'group4' if case_id in GROUP4 else 'group3' if case_id in GROUP3 else 'group2'
    if case_id in contract_inputs.get(dataset, {}):
        profiles = contract_inputs[dataset][case_id]
        by_title = {profile['name']: profile for profile in profiles}
        if len(by_title) != len(profiles) or set(by_title) != {a['title'] for _, a in assertions} or len(assertions) != len(profiles):
            raise ValueError(f'Executed scenarios do not match shared dataset for {case_id}')
        adapter={'group2':group2_vector,'group3':group3_vector,'group4':group4_vector,'group5':group5_vector,'group6':group6_vector}[dataset]
        return [adapter(case_id, by_title[a['title']], suite, a) for suite, a in assertions]
    cases=[]
    for suite,assertion in assertions:
        title=assertion['title']; category='A'; resolves=False; http=401; code='IC'
        confirms={}; vector={}
        if case_id=='UT-002':
            vector={'User':'ACTIVE','Lookup':'found','Compare':'false','Failures':'3','Lock':'null','Clock':'fixed'}
            confirms={'Không token':True,'Cập nhật count':True,'Giữ lock':False}
            match=re.fullmatch(r'increments (\d+) previous failures once, locking at the fifth failure',title)
            expired=re.fullmatch(r'restarts the counter at one when the previous lock expires at now (-?\d+) ms',title)
            if match:
                prior=int(match.group(1));vector['Failures']=str(prior)
                category='B' if prior in (0,4) else 'A'
                vector['Khóa mới']='15m' if prior==4 else 'none'
            elif title=='preserves an active lock one millisecond before expiry without another counter write':
                vector.update(Failures='5',Lock='now+1ms');category='B';code='TL'
                confirms.update({'Cập nhật count':False,'Giữ lock':True})
            elif expired:
                vector.update(Failures='5',Lock='now'+expired.group(1)+'ms');category='B'
            elif title=='locks after five consecutive failures, blocks retry, and restarts after exactly 15 minutes':
                vector.update(Failures='0',Clock='+15m',Sequence='5/lock/retry');category='B';code='MIX'
            else:raise ValueError(f'No input profile for {case_id}: {title}')
        elif case_id=='UT-003':
            vector={'Lookup':'null','Compare':'false','Hash':'dummy','Calls':'1'}
            confirms={'Không token':True,'Null: 0 tx':True,'Lỗi như known':False}
            match=re.fullmatch(r'rejects a null lookup even when the dummy comparison returns (true|false)',title)
            if match:vector['Compare']=match.group(1)
            elif title=='returns the same public status and body as a known account with a wrong password':
                vector.update(Lookup='found/null',Hash='stored/dummy',Calls='2');confirms['Lỗi như known']=True
            else:raise ValueError(f'No input profile for {case_id}: {title}')
        elif case_id=='UT-004':
            if title not in contract_inputs:raise ValueError(f'Cannot extract validator input: {title}')
            vector=contract_inputs[title]
            resolves=title.startswith(('accepts ','normalizes '));http=None if resolves else 400;code=None if resolves else 'VAL'
            category='N' if resolves else 'A'
            if any(x in title for x in ('boundary','exceeds','73 UTF-8','empty password','empty deviceId','exactly 255')):category='B'
            confirms={'Service 0 lần':not resolves,'Service 1 lần':resolves,'Chuẩn hóa DTO':title.startswith('normalizes ')}
        elif case_id=='UT-005':
            vector={'RT lookup':'found','Session ID':'set','Locked user':'found','User':'ACTIVE','Session':'found',
                    'Owner':'same','Sess.revoked':'no','Sess.expiry':'+60s','RT.revoked':'no','RT.consumed':'no',
                    'RT.expiry':'+45s','Consume rows':'1','Dependency':'none','Versions':'normal','Roles':'USER+CA','Body pipe':'no'}
            resolves=True;http=None;code=None;category='N'
            positives={
                'consumes the old refresh once, renews the same session, and returns the correct safe token contract',
                'runs the configured RefreshRequest body pipe and delegates once through the controller',
                'uses the current identity roles and preserves bigint version precision',
                'accepts session and refresh expiry one millisecond after now',
            }
            guards={
                'inactive user':{'User':'INACTIVE'},'suspended user':{'User':'SUSPENDED'},
                'missing session':{'Session':'null'},'foreign session owner':{'Owner':'foreign'},
                'revoked session':{'Sess.revoked':'yes'},'session expires exactly now':{'Sess.expiry':'now'},
                'session expired one millisecond ago':{'Sess.expiry':'now-1ms'},
                'revoked refresh token':{'RT.revoked':'yes'},'consumed refresh token':{'RT.consumed':'yes'},
                'refresh expires exactly now':{'RT.expiry':'now'},'refresh expired one millisecond ago':{'RT.expiry':'now-1ms'},
            }
            guard=re.fullmatch(r'does not rotate when the locked current state has (.+)',title)
            dependency=re.fullmatch(r'propagates (consume|renew|refresh-write|jwt) failure without reporting refresh success',title)
            if title in positives:
                if title.startswith('runs the configured'):vector['Body pipe']='yes'
                if title.startswith('uses the current'):vector.update(Versions='bigint',Roles='USER');category='B'
                if title.startswith('accepts session'):vector.update({'Sess.expiry':'now+1ms','RT.expiry':'now+1ms'});category='B'
            else:
                resolves=False;http=401;code='RT';category='A'
                if guard and guard.group(1) in guards:
                    vector.update(guards[guard.group(1)])
                    if 'expir' in guard.group(1):category='B'
                elif title=='refuses missing token before starting a transaction':vector['RT lookup']='null'
                elif title=='refuses missing sessionId before starting a transaction':vector['Session ID']='null'
                elif title=='refuses a lost atomic consume instead of issuing another token pair':vector['Consume rows']='0';category='B'
                elif title=='does not rotate when the user disappears before the row lock is read':vector['Locked user']='null';http=404;code='NF'
                elif dependency:vector['Dependency']=dependency.group(1);http='ERR';code='DEP'
                else:raise ValueError(f'No input profile for {case_id}: {title}')
            confirms={'Cùng user/sid':resolves,'Rotate + hash':resolves,'Không phát mới':not resolves}
        else:
            raise ValueError(f'Add an input adapter for {case_id}; a flat result table is not a matrix.')
        cases.append({'title':title,'vector':vector,'category':category,'resolves':resolves,'http':http,'code':code,
                      'confirms':confirms,'status':assertion['status'],'executedAt':suite.get('endTime')})
    return cases


def append_requirement_matrices(root,matrix,plan,grouped,scopes,functions,results,creator,epoch,template_data,requirement_texts=None,start=46):
    """Clone UT-001 sections and native styles for each requirement's own input vector."""
    with zipfile.ZipFile(io.BytesIO(template_data)) as package:
        raw=ET.fromstring(package.read(sheet_parts(template_data)['Q1_Unit test-case']))
        source_cells={c.get('r') for c in raw.findall('.//s:sheetData/s:row/s:c',NS)}
    extra_ids=sorted(key for key in grouped if key!='UT-001')
    contract_inputs={'group2':json.loads((root/'tests/fixtures/group2-cases.json').read_text(encoding='utf-8'))} if any(k in GROUP2 for k in extra_ids) else {}
    if any(k in GROUP3 for k in extra_ids):
        contract_inputs['group3']=json.loads((root/'tests/fixtures/group3-cases.json').read_text(encoding='utf-8'))
    if any(k in GROUP4 for k in extra_ids):
        contract_inputs['group4']=json.loads((root/'tests/fixtures/group4-cases.json').read_text(encoding='utf-8'))
    if any(k in GROUP5 for k in extra_ids):
        contract_inputs['group5']=json.loads((root/'tests/fixtures/group5-cases.json').read_text(encoding='utf-8'))
    if any(k in GROUP6 for k in extra_ids):
        contract_inputs['group6']=json.loads((root/'tests/fixtures/group6-cases.json').read_text(encoding='utf-8'))
    if 'UT-004' in extra_ids:
        files={suite['name'] for suite,assertion in grouped['UT-004']}
        if len(files)!=1:raise ValueError('UT-004 must map to one source file.')
        extracted=subprocess.run(['node','-e',NODE_CONTRACT_INPUTS],input=json.dumps({'file':next(iter(files))}),
                                 capture_output=True,text=True,encoding='utf-8',cwd=root)
        if extracted.returncode:raise ValueError('Contract fixture extraction failed: '+extracted.stderr[-2000:])
        raw=json.loads(extracted.stdout);contract_inputs.update({c['title']:c['vector'] for c in raw})
        if len(raw)!=len({c['title'] for c in raw}) or {c['title'] for c in raw}!={a['title'] for s,a in grouped['UT-004']}:
            raise ValueError('Validator matrix inputs do not match the executed assertions.')
    models={key:scenario_vectors(key,grouped[key],contract_inputs) for key in extra_ids}
    marker=matrix.cell(start,1).value
    if marker in (MATRIX_TITLE, MATRIX_END, f'MA TRẬN {extra_ids[0]}'):
        endings=[r for r in range(start,matrix.max_row+1) if matrix.cell(r,1).value==MATRIX_END]
        if len(endings)!=1:raise ValueError('Cannot identify the end of the managed matrix blocks.')
        old_end=endings[0];old_right=matrix.max_column
    elif marker==DETAIL_TITLE:
        old_end=start+3;old_right=27
        for r in range(start+4,matrix.max_row+1):
            label=str(matrix.cell(r,1).value or '');number=str(matrix.cell(r,2).value or '')
            if not ((re.fullmatch(r'UT-\d{3}',label) and re.fullmatch(r'UTCID\d+',number)) or
                    (re.match(r'^UT-\d{3} \| ',label) and matrix.cell(r,6).value is None)):break
            old_end=r
    elif marker is None:
        old_end=start-1;old_right=27
    else:raise ValueError('The destination contains manual content instead of a managed matrix.')
    layouts=[];cursor=start
    field_order={'UT-004':['Body','email.type','email.class','password.type','password.len','deviceId.type','deviceId.len','Extra']}
    for key,cases in models.items():
        observed={}
        for case in cases:
            for field,value in case['vector'].items():
                if value not in observed.setdefault(field,[]):observed[field].append(value)
        order=field_order.get(key,list(observed))
        conditions=[(field,value) for field in order for value in observed.get(field,[])]
        rows=max(20,len(conditions));extra=rows-20
        layouts.append({'id':key,'start':cursor,'end':cursor+42+extra,'conditions':conditions,'inputRows':rows,
                        'extra':extra,'cases':cases,'lastCol':max(27,5+len(cases))})
        cursor+=45+extra
    new_end=layouts[-1]['end'] if layouts else start
    right=max([27,old_right,*[layout['lastCol'] for layout in layouts]])
    for row in matrix.iter_rows(min_row=start,max_row=max(old_end,new_end),max_col=right):
        for c in row:
            if c.value is not None and not (c.row<=old_end and c.column<=old_right):
                raise ValueError(f'Matrix growth would overwrite manual content: {c.coordinate}')
    values,styles,heights=plan['values'],plan['styles'],plan['heights']
    for r in range(start,max(old_end,new_end)+1):
        for c in range(1,right+1):values[f'{get_column_letter(c)}{r}']=None
    base_merges=sorted((m for m in matrix.merged_cells.ranges if m.max_row<=43 and m.max_col<=27),
                       key=lambda m:(m.min_row,m.min_col,m.max_row,m.max_col))
    merges=[];records=[];blocks=[]
    requirements={
        'UT-002':'Sai mật khẩu; tăng số lần sai; lần 5 khóa 15 phút; hết khóa đếm lại. IC=INVALID_CREDENTIALS; TL=TEMPORARILY_LOCKED; MIX=cả IC/TL. Cột chuỗi kiểm tra 5 lần sai, chặn và retry sau 15 phút.',
        'UT-003':'Lookup null: từ chối, dùng dummy hash, không session/token và không lộ dữ liệu. Cột so sánh chạy known rồi null; không thêm transaction ở nhánh null. IC=INVALID_CREDENTIALS.',
        'UT-004':'Body/field types và giới hạn lấy từ fixture TypeScript thực tế; password chỉ ghi type/độ dài. VAL=VALIDATION_ERROR. DTO sai chặn trước service; DTO đúng được chuyển một lần.',
        'UT-005':'Giữ đúng user/session, consume refresh cũ một lần, lưu hash token mới; phiên 7 ngày, access 900 giây. RT=INVALID_REFRESH_TOKEN; NF=USER_NOT_FOUND; DEP=lỗi dependency.',
    }
    requirements.update(requirement_texts or {})
    legends={
        'UT-006':'RT=INVALID_REFRESH_TOKEN; NF=USER_NOT_FOUND; DEP=dependency error.',
        'UT-007':'RT=INVALID_REFRESH_TOKEN; NF=USER_NOT_FOUND; DEP=dependency error.',
        'UT-008':'EXP=deadline passed; DEP=draft storage/race error; Q1/Q2=two local snapshot IDs.',
        'UT-009':'VAL=DTO validation; OPT=invalid snapshot option; DUP=duplicate question ID.',
        'UT-010':'SN=question outside snapshot; OW=wrong owner; NF=attempt not found; ST=complete/legacy state.',
        'UT-011':'DUP=duplicate question ID. Invalid batches do not partially save/grade. Unique batch is the control.',
        'UT-012':'Each column saves B then null, reads both states, then submits. Q2=A remains correct; Q1=null is incorrect.',
        'UT-013':'EXP=409 deadline passed after valid expiry finalization; DEP=503 draft read failure. Only before deadline may accept B.',
        'UT-014':'ST=409 already complete. Submit/result may return the existing result without mutation.',
        'UT-015':'OW=403 wrong owner. Internal record lookup is allowed; no sensitive response/draft/scoring/write.',
        'UT-023':'DEP=draft failure (503 or raw Error); EXP=409 storage deadline race. Stub state does not prove DB rollback/concurrency.',
    }
    for key,legend in legends.items():
        if key in requirements:requirements[key]+=' '+legend
    for block in layouts:
        key=block['id'];offset=block['start']-1;extra=block['extra'];cases=block['cases'];last=5+len(cases)
        def row_at(source):return offset+source+(extra if source>=31 else 0)
        def at(column,source):return f'{column}{row_at(source)}'
        source_rows=[*range(1,11),*[11+(i%20) for i in range(block['inputRows'])],*range(31,44)]
        for local,source_row in enumerate(source_rows,1):
            target=offset+local
            heights[target]=matrix.row_dimensions[source_row].height or 15
            for col in range(1,block['lastCol']+1):
                letter=get_column_letter(col);address=f'{letter}{target}'
                reference=f'{get_column_letter(col if col<=27 else 6)}{source_row}'
                if reference not in source_cells:reference=f'F{source_row}' if f'F{source_row}' in source_cells else 'C3'
                styles[address]=reference
                if col<=20 and (source_row<=8 or col<=5) and source_row not in range(11,31):
                    c=matrix.cell(source_row,col)
                    if c.data_type!='f':values[address]=c.value
        for merged in base_merges:
            merges.append(f'{get_column_letter(merged.min_col)}{row_at(merged.min_row)}:{get_column_letter(merged.max_col)}{row_at(merged.max_row)}')
        values[at('A',1)]=MATRIX_TITLE if key==extra_ids[0] and start==46 else f'MA TRẬN {key}'
        styles[at('A',1)]='A6';merges.append(f'A{row_at(1)}:{get_column_letter(block["lastCol"])}{row_at(1)}')
        function=next(f for f in functions if f['name']==scopes[key]['name'])
        coverage_label='phạm vi' if key in (*GROUP4,*GROUP5) else 'hàm'
        values.update({at('C',2):key,at('L',2):function['signature'],at('C',3):creator,at('L',3):creator,
                       at('C',4):function['loc'],at('L',4):'N/A',
                       at('C',5):requirements[key]+f" Branch {coverage_label} (toàn lượt): {scopes[key]['coverage']['pct']:g}%. UTCID theo thứ tự Jest; kết quả từ test-results.json."})
        heights[row_at(2)]=56;heights[row_at(5)]=72
        if key in (*GROUP2,*GROUP3,*GROUP4,*GROUP5,*GROUP6):
            # Full trace/coverage is in the JSON summary; keep native metadata readable.
            values[at('L',2)]=function['name']+'(...)'
            heights[row_at(5)]=120
        if key in GROUP3:
            heights[row_at(5)]=180
        if key in (*GROUP4,*GROUP5):
            heights[row_at(5)]=180
        if key in GROUP6:
            heights[row_at(5)]=220
        for i in range(block['inputRows']):
            target=offset+11+i
            values[f'B{target}']=block['conditions'][i][0] if i<len(block['conditions']) else None
            values[f'D{target}']=block['conditions'][i][1] if i<len(block['conditions']) else None
            heights[target]=18
            if key in GROUP6 and i<len(block['conditions']):
                heights[target]=max(18,12*len(str(block['conditions'][i][1]).splitlines()))
        for source,text in [(32,'Resolve'),(33,'Reject'),(34,'HTTP lỗi'),(35,'Dạng lỗi')]:values[at('D',source)]=text
        if key in GROUP4:
            values[at('D',34)]='Error class'
            values[at('D',35)]='Error code'
        confirm_labels=[]
        for case in cases:
            for label in case['confirms']:
                if label not in confirm_labels:confirm_labels.append(label)
        if len(confirm_labels)>3:raise ValueError(f'Too many output rows for {key}')
        for source in (36,37,38):
            values[at('B',source)]='Confirm' if source==36 else None
            values[at('D',source)]=confirm_labels[source-36] if source-36<len(confirm_labels) else None
        values[at('B',35)]='Exception'
        for index,case in enumerate(cases,6):
            col=get_column_letter(index);ordinal=index-5
            values[at(col,9)]=f'UTCID{ordinal:02d}';values[at(col,10)]=f"{case['category']}{ordinal:02d}"
            for condition_index,(field,value) in enumerate(block['conditions']):
                values[f'{col}{offset+11+condition_index}']='O' if case['vector'].get(field)==value else None
            values[at(col,32)]='O' if case['resolves'] else None
            values[at(col,33)]=None if case['resolves'] else 'O'
            values[at(col,34)]=case['http'];values[at(col,35)]=case['code']
            for output,label in enumerate(confirm_labels,36):values[at(col,output)]='O' if case['confirms'].get(label) else None
            values[at(col,39)]=case['category'];values[at(col,40)]={'passed':'P','failed':'F'}.get(case['status'])
            date=datetime.fromtimestamp((case['executedAt'] or results['startTime'])/1000,TZ).replace(tzinfo=None).date()
            values[at(col,41)]=to_excel(date,epoch);values[at(col,42)]=None
            records.append({'requirement':key,'title':case['title'],'column':col,'headerRow':row_at(9),
                            'statusRow':row_at(40),'status':case['status'],'vector':case['vector'],
                            'resolves':case['resolves'],'http':case['http'],'code':case['code'],
                            'confirms':case['confirms'],'category':case['category'],'executedDate':date.isoformat()})
        counts=Counter(case['status'] for case in cases);types=Counter(case['category'] for case in cases)
        status_range=f'F{row_at(40)}:{get_column_letter(last)}{row_at(40)}'
        type_range=f'F{row_at(39)}:{get_column_letter(last)}{row_at(39)}'
        formulas={'A':(f'COUNTIF({status_range},"P")',counts['passed']),
                  'C':(f'COUNTIF({status_range},"F")',counts['failed']),
                  'F':(f'SUM(O{row_at(7)},-A{row_at(7)},-C{row_at(7)})',len(cases)-counts['passed']-counts['failed']),
                  'L':(f'COUNTIF({type_range},"N")',types['N']),
                  'M':(f'COUNTIF({type_range},"A")',types['A']),
                  'N':(f'COUNTIF({type_range},"B")',types['B']),
                  'O':(f'COUNTA(F{row_at(9)}:{get_column_letter(last)}{row_at(9)})',len(cases))}
        for col,(formula,cached) in formulas.items():values[at(col,7)]={'formula':formula,'cached':cached}
        heights[row_at(41)]=44
        blocks.append({'requirement':key,'range':f'A{block["start"]}:{get_column_letter(block["lastCol"])}{block["end"]}',
                       'codeCell':at('C',2),'passedCell':at('A',7),'totalCell':at('O',7),'cases':len(cases),
                       'conditionCount':len(block['conditions']),'headerRow':row_at(9),'statusRow':row_at(40)})
        blocks[-1].update(start=block['start'],conditions=block['conditions'],inputRows=block['inputRows'],extra=extra,confirmLabels=confirm_labels)
    values[f'A{new_end}']=MATRIX_END;styles[f'A{new_end}']='A6';heights[new_end]=18
    merges.append(f'A{new_end}:{get_column_letter(right)}{new_end}')
    plan.update(merges=merges,merge_from=start,merge_until=max(old_end,new_end),merge_columns=right)
    if start==46:
        plan['widths'].update({col:5 for col in range(6,right+1)})
    return {'count':len(records),'totalTagged':len(records)+len(grouped.get('UT-001',[])),
            'range':f'A46:{get_column_letter(right)}{new_end}','records':records,'matrices':blocks}


def build_updates(root, results, report_data, template_data, creator, results_sha256):
    report = load_workbook(io.BytesIO(report_data), keep_links=True)
    template = load_workbook(io.BytesIO(template_data), keep_links=True)
    cached_report = load_workbook(io.BytesIO(report_data), data_only=True, keep_links=True)
    try:
        sheet = report['Unit test']
        records = [(str(sheet.cell(r,1).value),r) for r in range(1,sheet.max_row+1) if re.fullmatch(r'UT-\d{3}',str(sheet.cell(r,1).value))]
        rows = dict(records)
        if len(rows) != 24 or len(records) != len(rows):
            raise ValueError('Expected 24 unique UT requirement rows in the report.')
        grouped = {}
        for suite in results['testResults']:
            for assertion in suite.get('assertionResults', []):
                ids = set(re.findall(r'\bUT-\d{3}\b', assertion.get('fullName', assertion.get('title', ''))))
                if len(ids) > 1:
                    raise ValueError('Ambiguous assertion mapped to multiple requirement IDs.')
                for case_id in ids:
                    if case_id not in rows:
                        raise ValueError(f'Unknown requirement ID in Jest results: {case_id}')
                    grouped.setdefault(case_id, []).append((suite, assertion))
        if 'UT-001' not in grouped:
            raise ValueError('No explicit UT-001 execution found; refusing to fabricate a matrix.')
        suites = {s['name'] for s, a in grouped['UT-001']}
        if len(suites) != 1:
            raise ValueError('UT-001 must belong to one unambiguous source suite.')
        source = Path(next(iter(suites))).resolve()
        if not source.is_relative_to(root) or not source.is_file():
            raise ValueError('Jest source test path is missing or belongs to another workspace.')
        model_result = subprocess.run(['node', '-e', NODE_EXTRACTOR], input=json.dumps({'root': str(root), 'file': str(source)}), text=True, encoding='utf-8', capture_output=True, cwd=root)
        if model_result.returncode:
            raise ValueError('TypeScript extraction failed: ' + model_result.stderr[-2000:])
        model = json.loads(model_result.stdout)
        group2_ids=[key for key in GROUP2 if key in grouped]
        group3_ids=[key for key in GROUP3 if key in grouped]
        group4_ids=[key for key in GROUP4 if key in grouped]
        group5_ids=[key for key in GROUP5 if key in grouped]
        group6_ids=[key for key in GROUP6 if key in grouped]
        group6_test=root/'services/exam-service/src/modules/attempts/attempt-view.group6.test.ts'
        had_group6=any(template['Q1_Unit test-case'].cell(r,3).value in GROUP6
                       for r in range(2,template['Q1_Unit test-case'].max_row+1))
        if (group6_test.is_file() or had_group6) and group6_ids!=list(GROUP6):
            raise ValueError('Missing Group 6 execution; refusing older-group fallback before writing. Run npm run test:unit.')
        if group6_ids and (group6_ids!=list(GROUP6) or set(grouped)!={f'UT-{i:03d}' for i in range(1,25)}):
            raise ValueError('Group 6 requires a full run of all 24 UT requirements.')
        group5_test=root/'services/exam-service/src/modules/attempts/attempts.group5.test.ts'
        had_group5=any(template['Q1_Unit test-case'].cell(r,3).value in GROUP5
                       for r in range(2,template['Q1_Unit test-case'].max_row+1))
        if (group5_test.is_file() or had_group5) and group5_ids!=list(GROUP5):
            raise ValueError('Missing Group 5 execution; refusing an older-group path that could erase historical matrices. Run npm run test:unit.')
        group2_sources={}
        group3_sources={}
        group4_sources={}
        group5_sources={}
        group6_sources={}
        if group5_ids and (group5_ids!=list(GROUP5) or group4_ids!=list(GROUP4) or
                          group3_ids!=list(GROUP3) or group2_ids!=list(GROUP2)):
            raise ValueError('Run all three Group 5 requirements and previous groups with npm run test:unit.')
        if group4_ids and (group4_ids!=list(GROUP4) or group3_ids!=list(GROUP3) or group2_ids!=list(GROUP2)):
            raise ValueError('Run both Group 4 requirements and all previous groups with npm run test:unit.')
        if group3_ids and (group3_ids!=list(GROUP3) or group2_ids!=list(GROUP2)):
            raise ValueError('Run all six Group 3 requirements and the previous groups with npm run test:unit.')
        if group2_ids:
            if group2_ids!=list(GROUP2):
                raise ValueError('Run all five Group 2 requirements before updating their matrices.')
            traced=subprocess.run(['node','-e',GROUP2_TRACE],cwd=root,capture_output=True,text=True,encoding='utf-8')
            if traced.returncode:raise ValueError('Group 2 trace failed: '+traced.stderr[-2000:])
            model['functions'].extend(json.loads(traced.stdout))
            dataset=root/'tests/fixtures/group2-cases.json'
            for key in group2_ids:
                files={s['name'] for s,a in grouped[key]}
                if len(files)!=1:raise ValueError(f'{key} must have one executed suite')
                test=Path(next(iter(files)))
                expected='auth.session-rejections.test.ts' if key in GROUP2[:2] else 'attempts.choices.test.ts'
                if test.name!=expected or not test.resolve().is_relative_to(root):
                    raise ValueError(f'Unexpected test source for {key}')
                source_text=test.read_text(encoding='utf-8')
                if f"it.each(cases['{key}'])" not in source_text or 'tests/fixtures/group2-cases.json' not in source_text:
                    raise ValueError(f'{key} must consume the shared matrix dataset')
                end=max(s.get('endTime',0) for s,a in grouped[key])
                for path in (test,dataset):
                    if path.stat().st_mtime*1000>end:
                        raise ValueError(f'Source is newer than Jest evidence; rerun npm run test:unit: {path}')
                    group2_sources[str(path.relative_to(root))]=digest(path.read_bytes())
            run_end=max(s.get('endTime',0) for key in group2_ids for s,a in grouped[key])
            fixture_paths=['services/auth-service/test/helpers/auth-harness.ts',
                           'services/exam-service/test/helpers/attempt-harness.ts']
            for relative in {*fixture_paths,*[f['file'] for f in model['functions']]}:
                path=root/relative
                if path.stat().st_mtime*1000>run_end:
                    raise ValueError(f'A dependency changed after Jest; rerun npm run test:unit: {relative}')
                group2_sources[relative]=digest(path.read_bytes())
        if group3_ids:
            dataset=root/'tests/fixtures/group3-cases.json'
            profiles=json.loads(dataset.read_text(encoding='utf-8'))
            if set(profiles)!=set(GROUP3):raise ValueError('Group 3 fixture must contain exactly the six authorized UTs.')
            for key in group3_ids:
                files={s['name'] for s,a in grouped[key]}
                if len(files)!=1:raise ValueError(f'{key} must have one executed suite')
                test=Path(next(iter(files))).resolve()
                if test.name!='attempts.group3.test.ts' or not test.is_relative_to(root):
                    raise ValueError(f'Unexpected test source for {key}')
                source_text=test.read_text(encoding='utf-8')
                if f"it.each(cases['{key}'])" not in source_text or 'tests/fixtures/group3-cases.json' not in source_text:
                    raise ValueError(f'{key} must consume the shared Group 3 dataset')
                names=[c['name'] for c in profiles[key]]
                if len(set(names))!=len(names) or sorted(names)!=sorted(a['title'] for s,a in grouped[key]):
                    raise ValueError(f'Group 3 source/executed dataset mismatch: {key}')
                end=max(s.get('endTime',0) for s,a in grouped[key])
                dependencies={test,dataset,root/'services/exam-service/test/helpers/attempt-harness.ts',
                              root/'tests/jest.setup.cjs',root/'jest.config.js',
                              root/'services/exam-service/src/modules/attempts/dto/attempt.dto.ts',
                              root/'services/exam-service/src/modules/attempts/dto/save-answer.dto.ts',
                              root/'services/exam-service/src/modules/attempts/attempt-view.ts',
                              root/'services/exam-service/src/scoring/scoring.service.ts'}
                dependencies.update(root/f['file'] for f in model['functions'])
                for path in dependencies:
                    if path.stat().st_mtime*1000>end:
                        raise ValueError(f'Source is newer than Jest evidence; rerun npm run test:unit: {path}')
                    group3_sources[str(path.relative_to(root))]=digest(path.read_bytes())
        if group4_ids:
            traced=subprocess.run(['node','-e',GROUP4_TRACE],cwd=root,capture_output=True,text=True,encoding='utf-8')
            if traced.returncode:raise ValueError('Group 4 trace failed: '+traced.stderr[-2000:])
            model['functions'].extend(json.loads(traced.stdout))
            dataset=root/'tests/fixtures/group4-cases.json'
            profiles=json.loads(dataset.read_text(encoding='utf-8'))
            if set(profiles)!=set(GROUP4):raise ValueError('Group 4 fixture must contain exactly UT-016 and UT-017.')
            for key in group4_ids:
                files={s['name'] for s,a in grouped[key]}
                if len(files)!=1:raise ValueError(f'{key} must have one executed suite')
                test=Path(next(iter(files))).resolve()
                if test.name!='scoring.group4.test.ts' or not test.is_relative_to(root):
                    raise ValueError(f'Unexpected test source for {key}')
                source_text=test.read_text(encoding='utf-8')
                if f"it.each(cases['{key}'])" not in source_text or 'tests/fixtures/group4-cases.json' not in source_text:
                    raise ValueError(f'{key} must consume the shared Group 4 dataset')
                names=[c['name'] for c in profiles[key]]
                if len(names)!=len(set(names)) or sorted(names)!=sorted(a['title'] for s,a in grouped[key]):
                    raise ValueError(f'Group 4 executed profiles mismatch: {key}')
                end=max(s.get('endTime',0) for s,a in grouped[key])
                dependencies={test,dataset,root/'tests/fixtures/group4-score-oracle.json',
                    root/'services/exam-service/test/helpers/attempt-harness.ts',root/'jest.config.js',root/'tests/jest.setup.cjs',
                    root/'services/exam-service/src/scoring/ets-listening.json',root/'services/exam-service/src/scoring/ets-reading.json',
                    root/'services/exam-service/src/modules/tests/test-rules.ts',
                    root/'services/exam-service/src/modules/attempts/attempt-view.ts',
                    root/'packages/contracts/p0/schemas/domain.schema.json',root/'packages/contracts/p0/runtime.cjs',
                    root/'packages/contracts/events/v2/TestSubmittedEvent.schema.json',
                    root/'packages/contracts/events/v2/PartPracticeSubmittedEvent.schema.json'}
                dependencies.update(root/f['file'] for f in model['functions'])
                for path in dependencies:
                    if path.stat().st_mtime*1000>end:
                        raise ValueError(f'Group 4 dependency is newer than Jest evidence: {path}')
                    group4_sources[str(path.relative_to(root))]=digest(path.read_bytes())
        if group5_ids:
            dataset=root/'tests/fixtures/group5-cases.json'
            profiles=json.loads(dataset.read_text(encoding='utf-8'))
            if set(profiles)!=set(GROUP5):raise ValueError('Group 5 fixture must contain exactly UT-018..020.')
            for key in group5_ids:
                files={s['name'] for s,a in grouped[key]}
                if len(files)!=1:raise ValueError(f'{key} must map to one executed suite')
                test=Path(next(iter(files))).resolve()
                if test.name!='attempts.group5.test.ts' or not test.is_relative_to(root):
                    raise ValueError(f'Unexpected test source for {key}')
                source_text=test.read_text(encoding='utf-8')
                if f"it.each(cases['{key}'])" not in source_text or 'tests/fixtures/group5-cases.json' not in source_text:
                    raise ValueError(f'{key} must consume the shared Group 5 fixture')
                names=[c['name'] for c in profiles[key]]
                if len(names)!=len(set(names)) or sorted(names)!=sorted(a['title'] for s,a in grouped[key]):
                    raise ValueError(f'Group 5 executed profiles mismatch: {key}')
                dependencies={test,dataset,root/'services/exam-service/test/helpers/submission-harness.ts',
                    root/'services/exam-service/test/helpers/attempt-harness.ts',root/'jest.config.js',root/'tests/jest.setup.cjs',
                    root/'services/exam-service/src/modules/attempts/attempt-view.ts',
                    root/'services/exam-service/src/modules/attempts/dto/attempt.dto.ts',
                    root/'services/exam-service/src/modules/tests/test-rules.ts',
                    root/'services/exam-service/src/scoring/ets-listening.json',root/'services/exam-service/src/scoring/ets-reading.json',
                    root/'packages/contracts/p0/runtime.cjs',root/'packages/contracts/p0/schemas/domain.schema.json',
                    root/'packages/contracts/events/v2/TestSubmittedEvent.schema.json',
                    root/'packages/contracts/events/v2/PartPracticeSubmittedEvent.schema.json'}
                dependencies.update(root/f['file'] for f in model['functions'])
                end=max(s.get('endTime',0) for s,a in grouped[key])
                for path in dependencies:
                    if path.stat().st_mtime*1000>end:
                        raise ValueError(f'Group 5 dependency is newer than Jest evidence: {path}')
                    group5_sources[str(path.relative_to(root))]=digest(path.read_bytes())
        if group6_ids:
            traced=subprocess.run(['node','-e',GROUP6_TRACE],cwd=root,capture_output=True,text=True,encoding='utf-8')
            if traced.returncode:raise ValueError('Group 6 AST trace failed: '+traced.stderr[-2000:])
            model['functions'].extend(json.loads(traced.stdout))
            dataset=root/'tests/fixtures/group6-cases.json'
            profiles=json.loads(dataset.read_text(encoding='utf-8'))
            if set(profiles)!=set(GROUP6):raise ValueError('Group 6 fixture must contain exactly UT-021, UT-022, UT-024.')
            for key in group6_ids:
                files={s['name'] for s,a in grouped[key]}
                if len(files)!=1:raise ValueError(f'{key} must map to one executed suite')
                test=Path(next(iter(files))).resolve()
                if test!=group6_test.resolve():raise ValueError(f'Unexpected Group 6 test source: {key}')
                source_text=test.read_text(encoding='utf-8')
                if f"it.each(cases['{key}'])" not in source_text or 'tests/fixtures/group6-cases.json' not in source_text:
                    raise ValueError(f'{key} must consume the shared Group 6 fixture')
                names=[c['name'] for c in profiles[key]]
                if len(names)!=len(set(names)) or sorted(names)!=sorted(a['title'] for s,a in grouped[key]):
                    raise ValueError(f'Group 6 executed dataset mismatch: {key}')
                dependencies={test,dataset,root/'services/exam-service/test/helpers/attempt-view-fixture.ts',
                    root/'services/exam-service/test/helpers/attempt-harness.ts',root/'jest.config.js',root/'tests/jest.setup.cjs',
                    root/'services/exam-service/prisma/schema.prisma',root/'packages/contracts/openapi/openapi.yaml',
                    root/'services/exam-service/src/modules/attempts/draft.store.ts'}
                dependencies.update(root/f['file'] for f in model['functions'])
                end=max(s.get('endTime',0) for s,a in grouped[key])
                for path in dependencies:
                    if path.stat().st_mtime*1000>end:
                        raise ValueError(f'Group 6 source is newer than Jest evidence: {path}')
                    group6_sources[str(path.relative_to(root))]=digest(path.read_bytes())
        actual = {a['title']: (s, a) for s, a in grouped['UT-001']}
        if len(actual) != len(grouped['UT-001']) or set(actual) != {c['title'] for c in model['cases']}:
            raise ValueError('Executed assertions do not match current test-source scenarios.')
        for case in model['cases']:
            suite, assertion = actual[case['title']]
            case['execution'] = assertion['status']
            case['executedAt'] = suite.get('endTime', results['startTime'])
        coverage = results.get('coverageMap', {})
        global_coverage = branch_coverage(coverage)
        login_names={'AuthService.login','AuthService.issueTokens','AuthController.login','UserPresenter.present','lockedUser','tokenHash','failure'}
        login_functions=[f for f in model['functions'] if f['name'] in login_names]
        login_coverage = branch_coverage(coverage, login_functions)
        if not login_coverage['total']:
            raise ValueError('Missing branch evidence for the login scope.')
        scopes={'UT-001':{'name':'luồng login','coverage':login_coverage}}
        for case_id,name in [('UT-002','AuthService.login'),('UT-003','AuthService.login'),('UT-004','ContractPipe.transform'),('UT-005','AuthService.refresh')]:
            functions=[f for f in model['functions'] if f['name']==name]
            measured=branch_coverage(coverage,functions)
            if case_id in grouped and measured['pct'] is None:
                raise ValueError(f'Missing branch evidence for {case_id}: {name}')
            scopes[case_id]={'name':name,'coverage':measured}
        for key,name in zip(GROUP2,['AuthService.refresh','AuthService.logout','AttemptsService.saveDraft',
                                    'AttemptsService.validateChoices','AttemptsService.validateChoices']):
            if key not in grouped:continue
            functions=[f for f in model['functions'] if f['name']==name]
            measured=branch_coverage(coverage,functions)
            if measured['pct'] is None:raise ValueError(f'Missing branch evidence for {key}: {name}')
            scopes[key]={'name':name,'coverage':measured,'measurement':'function branches across the full Jest run'}
        group3_scope_names={
            'UT-011':['AttemptsService.validateChoices'],
            'UT-012':['AttemptsService.saveDraft','AttemptsService.saveAnswer'],
            'UT-013':['AttemptsService.saveDraft','AttemptsService.submit','AttemptsService.getResult'],
            'UT-014':['AttemptsService.saveDraft','AttemptsService.submit'],
            'UT-015':['AttemptsService.owner','AttemptsService.getResult','AttemptsService.saveDraft','AttemptsService.submit'],
            'UT-023':['AttemptsService.saveDraft','AttemptsService.saveAnswer','DraftStore.call','DraftStore.write'],
        }
        for key in group3_ids:
            names=group3_scope_names[key]
            measured=branch_coverage(coverage,[f for f in model['functions'] if f['name'] in names])
            if measured['pct'] is None:raise ValueError(f'Missing Group 3 branch evidence: {key}')
            scopes[key]={'name':names[0],'coverage':measured,'functionNames':names,
                         'measurement':'selected function branches across the full Jest run; finalize is a separately reported dependency'}
        group4_scope_names={
            'UT-016':['partStats'],
            'UT-017':['ScoringService.full','lookupEtsScore','loadEtsScoreTable','validateEtsScoreTable',
                      'ScoringService.constructor','ScoringService.provenance'],
        }
        for key in group4_ids:
            names=group4_scope_names[key]
            measured=branch_coverage(coverage,[f for f in model['functions'] if f['name'] in names])
            if measured['pct'] is None:raise ValueError(f'Missing Group 4 coverage: {key}')
            scopes[key]={'name':names[0],'coverage':measured,'functionNames':names,
                         'measurement':'selected scoring functions across full Jest run; zero instrumented branches = N/A 0/0; finalize is a dependency'}
        group5_scope_names={key:['AttemptsService.submit','AttemptsService.finalize'] for key in GROUP5}
        for key in group5_ids:
            names=group5_scope_names[key]
            measured=branch_coverage(coverage,[f for f in model['functions'] if f['name'] in names])
            if measured['pct'] is None:raise ValueError(f'Missing Group 5 branch evidence: {key}')
            scopes[key]={'name':names[0],'coverage':measured,'functionNames':names,
                         'measurement':'union of submit/finalize branches across full Jest run; not standalone submit coverage'}
        for key in group6_ids:
            measured=branch_coverage(coverage,[f for f in model['functions'] if f['name']=='attemptView'])
            if measured['pct'] is None:raise ValueError(f'Missing Group 6 coverage: {key}')
            scopes[key]={'name':'attemptView','coverage':measured,'functionNames':['attemptView'],
                         'measurement':'presenter including nested callbacks and url; url separately reported, never summed twice; full Jest run'}
        values, caches, report_heights = {}, {}, {}
        current = {case_id: str(sheet.cell(row, 6).value) for case_id, row in rows.items()}
        statuses = {}
        update_ids=set(group6_ids or group5_ids or group4_ids or group3_ids or group2_ids or grouped)
        for case_id, assertions in grouped.items():
            outcomes = [a['status'] for s, a in assertions]
            status = 'Failed' if 'failed' in outcomes else 'Passed' if all(v == 'passed' for v in outcomes) else 'Pending'
            statuses[case_id] = current[case_id] = status
            if case_id not in update_ids:
                if str(sheet.cell(rows[case_id],6).value)!=status:
                    raise ValueError(f'Previous result changed for {case_id}; refusing to alter a historical round silently.')
                continue
            row = rows[case_id]
            values[f'F{row}'] = status
            executed = max(s.get('endTime', results['startTime']) for s, a in assertions)
            date = datetime.fromtimestamp(executed / 1000, TZ).replace(tzinfo=None)
            values[f'G{row}'] = to_excel(date.date(), report.epoch)
            values[f'H{row}'] = creator
            original = str(sheet[f'O{row}'].value or '')
            kept = [line for line in original.splitlines() if not line.startswith(('Thiết kế; chưa thực thi.', '[JEST Round 1]'))]
            measured=scopes.get(case_id)
            scope = f"{measured['name']} {measured['coverage']['pct']:g}% (toàn lượt); " if measured else ''
            if case_id in (*GROUP4,*GROUP5):
                scope=f"phạm vi {case_id} {measured['coverage']['pct']:g}% (toàn lượt); "
            run_id = datetime.fromtimestamp(results['startTime'] / 1000, TZ).strftime('%Y%m%d-%H%M%S')
            note = f"[JEST Round 1] {status}: {outcomes.count('passed')}/{len(outcomes)} passed; branch {scope}toàn lượt {global_coverage['pct']:g}%; file: test-results.json; run: {run_id}."
            if case_id in GROUP3:
                note+=' SHA-256 results: '+results_sha256+'. Scope: '+', '.join(scopes[case_id]['functionNames'])+'. Mock transaction does not prove rollback/concurrency.'
            if case_id in GROUP4:
                note+=' SHA-256 results: '+results_sha256+'. Scope: '+('partStats' if case_id=='UT-016' else 'full + lookup/table guards + constructor/provenance')+'. Reference 2026.10-sample, official=false. Full/loader: N/A (0/0 branches).'
            if case_id in GROUP5:
                note+=' SHA-256 results: '+results_sha256+'. Scope: submit + finalize; standalone function coverage in update-summary.json. DB/Redis/RPC stub; scoring/event validators real. Serial unit calls; concurrency/rollback not established.'
            if case_id in GROUP6:
                note+=' SHA-256 results: '+results_sha256+'. Scope: attemptView, including nested URL/array callbacks. Pure persisted fixtures; no finalize, DB, Redis or RPC. Group 6 coverage and per-function coverage in update-summary.json.'
            values[f'O{row}'] = '\n'.join([*kept, note])
            if case_id in (*GROUP4,*GROUP5,*GROUP6):
                # Existing report rows were sized for short design notes. Fit only
                # these two new execution notes; never resize historical rows.
                width=max(12,int(sheet.column_dimensions['O'].width)-3)
                lines=sum(max(1,len(textwrap.wrap(line,width=width))) for line in values[f'O{row}'].splitlines())
                report_heights[row]=min(409.5,max(sheet.row_dimensions[row].height or 15,
                    lines*float(sheet.cell(row,15).font.sz or 11)*1.5+12))
        counts = Counter(current.values())
        for column, status in [('B', 'Passed'), ('C', 'Failed'), ('D', 'Pending'), ('E', 'N/A')]:
            caches[f'{column}6'] = counts[status]
        caches['B4'] = len(rows)
        report_parts = sheet_parts(report_data)
        changes = {report_parts['Unit test']: dict(values=values, caches=caches, heights=report_heights, styles={})}
        # Keep existing array/INDEX formulas and refresh only their cached results.
        stats = report['Test Statistics']
        selected = int(stats['C8'].value)
        if selected not in (1, 2, 3):
            raise ValueError('Invalid statistics round selector.')
        stat_cache = {'H11': len(rows)}
        for col, source_col in [('D','B'),('E','C'),('F','D'),('G','E')]:
            stat_cache[col + '11'] = caches[source_col + '6'] if selected == 1 else cached_report['Unit test'][f'{source_col}{selected + 5}'].value
        for col in 'DEFGH':
            stat_cache[col + '17'] = stat_cache[col + '11'] + sum(cached_report['Test Statistics'][f'{col}{r}'].value or 0 for r in range(12, 16))
        stats_note = f"Thống kê 5 nhóm / {int(stat_cache['H17'])} ca theo vòng chọn ở C8. Kết quả Unit test đồng bộ từ Jest theo mã UT; ca chưa có bằng chứng giữ Pending."
        changes[report_parts['Test Statistics']] = dict(values={'C6':stats_note}, caches=stat_cache, heights={}, styles={})

        matrix = template['Q1_Unit test-case']
        main = next(f for f in model['functions'] if f['name'] == 'AuthService.login')
        other = '; '.join(f"{f['name']} ({f['loc']} LOC)" for f in login_functions if f != main)
        mv = {'C2':'UT-001', 'L2': main['signature'], 'C3':creator, 'L3':creator, 'C4':main['loc'],
              'C5':f"Inputs: email={model['inputs']['email']!r}; deviceId={model['inputs']['deviceId']}; password mô phỏng, không ghi mật khẩu. Login ACTIVE: đúng user/session/token một lần; reset bộ đếm; không passwordHash. Nhánh login: {login_coverage['pct']:g}%. Hàm liên quan: {other}.",
              'D32':'Resolve', 'D33':'Reject', 'D34':'HTTP lỗi', 'B35':'Exception', 'D35':'Stage lỗi',
              'B36':'Confirm', 'D36':'User an toàn', 'D37':'1 session/token', 'D38':'Reset count=0'}
        conditions = [
            ('email','trim/lower',lambda c: True), ('locked user','không có',lambda c: not c['lockedFound']),
            ('password','khớp',lambda c: c['compare'] is True), ('password','sai',lambda c: c['compare'] is False),
            ('user lookup','tồn tại',lambda c: c['found'] is True), ('user lookup','không có',lambda c: c['found'] is False),
            ('passwordHash','null',lambda c: not c['hashPresent']),
            ('status','ACTIVE',lambda c: c['status']=='ACTIVE'), ('status','INACTIVE',lambda c: c['status']=='INACTIVE'), ('status','SUSPENDED',lambda c: c['status']=='SUSPENDED'),
            ('lockedUntil','null',lambda c: c['lockedOffset'] is None), ('lockedUntil','now - 1 ms',lambda c: c['lockedOffset']==-1),
            ('lockedUntil','now',lambda c: c['lockedOffset']==0), ('lockedUntil','now + 1 ms',lambda c: c['lockedOffset']==1),
            ('failedCount','0',lambda c: c['failedCount']==0), ('failedCount','3',lambda c: c['failedCount']==3),
            ('failedCount','4',lambda c: c['failedCount']==4), ('failedCount','5',lambda c: c['failedCount']==5),
            ('hash changed','có',lambda c: c['hashChanged']), ('dependency','reject',lambda c: c['dependency'] is not None),
        ]
        for row, (name, label, predicate) in enumerate(conditions, 11):
            mv[f'B{row}'], mv[f'D{row}'] = name, label
        styles = {}
        stages = {'lookup':'Lkp','password':'Pwd','reset':'Rst','session':'Ses','refresh':'Ref','jwt':'JWT','presenter':'Avt'}
        for index, case in enumerate(model['cases'], 6):
            col = get_column_letter(index)
            mv[col+'9'] = f'UTCID{index-5:02d}'
            mv[col+'10'] = re.search(r'/([NAB]\d+):', case['title']).group(1)
            for row, (_, _, predicate) in enumerate(conditions, 11):
                mv[f'{col}{row}'] = 'O' if predicate(case) else None
            mv[col+'32'] = 'O' if case['resolves'] else None
            mv[col+'33'] = None if case['resolves'] else 'O'
            mv[col+'34'] = case['httpStatus'] or ('ERR' if case['dependency'] else None)
            mv[col+'35'] = stages.get(case['dependency'])
            for row in (36,37,38):
                mv[f'{col}{row}'] = 'O' if case['resolves'] else None
            mv[col+'31'] = None
            mv[col+'39'] = case['category']
            mv[col+'40'] = {'passed':'P','failed':'F'}.get(case['execution'])
            mv[col+'41'] = to_excel(datetime.fromtimestamp(case['executedAt']/1000,TZ).replace(tzinfo=None).date(), template.epoch)
            mv[col+'42'] = None
            for row in range(9,43):
                styles[f'{col}{row}'] = f'{"O" if index==27 else "F"}{row}'
        # Remove sample outcomes outside the executed matrix; never count template examples.
        for row in (9,10,39,40,41,42):
            for col in range(6+len(model['cases']),28):
                if matrix.cell(row,col).value is not None:
                    raise ValueError('Existing unrelated matrix cases would be overwritten.')
        ct = Counter(c['execution'] for c in model['cases'])
        categories = Counter(c['category'] for c in model['cases'])
        mc = {'A7':ct['passed'],'C7':ct['failed'],'F7':len(model['cases'])-ct['passed']-ct['failed'],
              'L7':categories['N'],'M7':categories['A'],'N7':categories['B'],'O7':len(model['cases'])}
        tchanges = {sheet_parts(template_data)['Q1_Unit test-case']:dict(values=mv,caches=mc,
                    heights={2:56,5:60,10:22,**{r:18 for r in range(11,39)},41:44},styles=styles,
                    widths={c:5 for c in range(6,28)})}
        if group6_ids:
            # Newest group wins over all older assertions in the same full run.
            existing_list=[(str(matrix.cell(r,3).value),r) for r in range(2,matrix.max_row+1)
                           if re.fullmatch(r'UT-\d{3}',str(matrix.cell(r,3).value))]
            existing=dict(existing_list)
            if len(existing)!=len(existing_list):raise ValueError('Duplicate historical matrix IDs.')
            preserved=[*[f'UT-{i:03d}' for i in range(1,21)],'UT-023']
            if not all(key in existing for key in preserved):raise ValueError('Expected 21 previous matrices before Group 6.')
            endings=[r for r in range(46,matrix.max_row+1) if matrix.cell(r,1).value==MATRIX_END]
            if len(endings)!=1:raise ValueError('Cannot identify the managed Group 6 boundary.')
            present=[key for key in GROUP6 if key in existing]
            if present and set(present)!=set(GROUP6):raise ValueError('Partial Group 6 matrices require review.')
            if set(existing)-set(preserved)-set(GROUP6):raise ValueError('Unexpected existing matrix ID.')
            start=min(existing[key]-1 for key in present) if present else endings[0]
            if any(existing[key]>=start for key in preserved):raise ValueError('Group 6 overlaps a historical matrix.')
            run_id=datetime.fromtimestamp(results['startTime']/1000,TZ).strftime('%Y%m%d-%H%M%S')
            requirement_texts={key:'\n'.join(str(sheet.cell(rows[key],col).value or '') for col in (2,3,4,5))+
                '\nRun ID: '+run_id+'; test-results.json SHA-256: '+results_sha256+
                '\nScope: attemptView (nested URL/array callbacks included once). Pure valid persisted records, FULL 200/7 Parts; PART 69/Parts3,5. K/E/T=correctOption/explanation/transcript. R=right, W=wrong, Z=null, B=blank; Z/B saved as null. IN_PROGRESS secrets absent, scores null, Full-only fields absent. Final view ignores conflicting drafts. Clock D=server deadline; sequence offsets in ms from D (read top-to-bottom). Rule=max(0,ceil((D-now)/1000)); view never finalizes. Function coverage: update-summary.json.'
                for key in group6_ids}
            tchanges={sheet_parts(template_data)['Q1_Unit test-case']:dict(values={},caches={},heights={},styles={},widths={})}
            details=append_requirement_matrices(root,matrix,next(iter(tchanges.values())),
                {key:grouped[key] for key in group6_ids},scopes,model['functions'],results,creator,
                template.epoch,template_data,requirement_texts,start)
            details['preservedRange']=f'A1:{get_column_letter(matrix.max_column)}{start-1}'
            details['preservedMatrices']=preserved
            details['totalTagged']=sum(len(v) for v in grouped.values())
        elif group5_ids:
            # Full runs also contain Groups 2/3/4. Select Group 5 first and keep
            # all eighteen historical matrices, including the earlier UT-023.
            existing={str(matrix.cell(r,3).value):r for r in range(2,matrix.max_row+1)
                      if re.fullmatch(r'UT-\d{3}',str(matrix.cell(r,3).value))}
            preserved=[*[f'UT-{i:03d}' for i in range(1,18)],'UT-023']
            if not all(key in existing for key in preserved):raise ValueError('Expected eighteen previous matrices before Group 5.')
            endings=[r for r in range(46,matrix.max_row+1) if matrix.cell(r,1).value==MATRIX_END]
            if len(endings)!=1:raise ValueError('Cannot identify a unique managed matrix boundary.')
            present=[key for key in GROUP5 if key in existing]
            if present and set(present)!=set(GROUP5):raise ValueError('Partial Group 5 matrices require review.')
            start=min(existing[key]-1 for key in present) if present else endings[0]
            if any(existing[key]>=start for key in preserved):raise ValueError('Group 5 overlaps previous matrices.')
            run_id=datetime.fromtimestamp(results['startTime']/1000,TZ).strftime('%Y%m%d-%H%M%S')
            requirement_texts={key:'\n'.join(str(sheet.cell(rows[key],col).value or '') for col in (2,3,4,5))+
                '\nRun ID: '+run_id+'; test-results.json SHA-256: '+results_sha256+
                '\nScope: submit + finalize. Function coverage is reported separately. 1R=Q1 correct; W=wrong; Z=null; absent Q4=blank. RD=draft read 503. D=deadline. FULL uses 200 validated questions; PART uses Part2/25. Serial stubs do not prove concurrency or rollback.'
                for key in group5_ids}
            tchanges={sheet_parts(template_data)['Q1_Unit test-case']:dict(values={},caches={},heights={},styles={},widths={})}
            details=append_requirement_matrices(root,matrix,next(iter(tchanges.values())),
                {key:grouped[key] for key in group5_ids},scopes,model['functions'],results,creator,
                template.epoch,template_data,requirement_texts,start)
            details['preservedRange']=f'A1:{get_column_letter(matrix.max_column)}{start-1}'
            details['preservedMatrices']=preserved
            details['totalTagged']=sum(len(v) for v in grouped.values())
        elif group4_ids:
            # Highest/newest group wins. Group 2/3 are present in a full run but
            # must never consume this path or rewrite their historical matrices.
            existing={str(matrix.cell(r,3).value):r for r in range(2,matrix.max_row+1)
                      if re.fullmatch(r'UT-\d{3}',str(matrix.cell(r,3).value))}
            preserved=[*[f'UT-{i:03d}' for i in range(1,16)],'UT-023']
            if not all(key in existing for key in preserved):raise ValueError('Expected all sixteen previous matrices before Group 4.')
            endings=[r for r in range(46,matrix.max_row+1) if matrix.cell(r,1).value==MATRIX_END]
            if len(endings)!=1:raise ValueError('Cannot identify a unique managed matrix boundary.')
            present=[key for key in GROUP4 if key in existing]
            if present and set(present)!=set(GROUP4):raise ValueError('Partial Group 4 matrices require review.')
            start=min(existing[key]-1 for key in present) if present else endings[0]
            if any(existing[key]>=start for key in preserved):raise ValueError('Group 4 overlaps previous matrices.')
            run_id=datetime.fromtimestamp(results['startTime']/1000,TZ).strftime('%Y%m%d-%H%M%S')
            requirement_texts={key:'\n'.join(str(sheet.cell(rows[key],col).value or '') for col in (2,3,4,5))+
                '\nRun ID: '+run_id+'; test-results.json SHA-256: '+results_sha256+
                '\nScope: '+', '.join(scopes[key]['functionNames'])+
                '\nL/R=Listening/Reading; c/t=correct/total. ERR=Error; 503=ServiceUnavailableException. RAW=raw guard; TBL=table guard; IO=file failure; PV=provenance guard. Dev fallback returns a table then PV rejects it. Reference 2026.10-sample, official=false.'
                for key in group4_ids}
            tchanges={sheet_parts(template_data)['Q1_Unit test-case']:dict(values={},caches={},heights={},styles={},widths={})}
            details=append_requirement_matrices(root,matrix,next(iter(tchanges.values())),
                {key:grouped[key] for key in group4_ids},scopes,model['functions'],results,creator,
                template.epoch,template_data,requirement_texts,start)
            details['preservedRange']=f'A1:{get_column_letter(matrix.max_column)}{start-1}'
            details['preservedMatrices']=preserved
            details['totalTagged']=sum(len(v) for v in grouped.values())
        elif group3_ids:
            # A Group 2 run must never select the old append path and omit Group 3.
            existing={str(matrix.cell(r,3).value):r for r in range(2,matrix.max_row+1)
                      if re.fullmatch(r'UT-\d{3}',str(matrix.cell(r,3).value))}
            preserved=[f'UT-{i:03d}' for i in range(1,11)]
            if not all(key in existing for key in preserved):
                raise ValueError('Expected all ten previous matrices before Group 3.')
            endings=[r for r in range(46,matrix.max_row+1) if matrix.cell(r,1).value==MATRIX_END]
            if len(endings)!=1:raise ValueError('Cannot identify a unique managed matrix boundary.')
            present=[key for key in GROUP3 if key in existing]
            if present and set(present)!=set(GROUP3):raise ValueError('Partial Group 3 matrices require review before overwriting.')
            start=min(existing[key]-1 for key in present) if present else endings[0]
            if any(existing[key]>=start for key in preserved):raise ValueError('Group 3 overlaps previous matrices.')
            run_id=datetime.fromtimestamp(results['startTime']/1000,TZ).strftime('%Y%m%d-%H%M%S')
            requirement_texts={key:'\n'.join(str(sheet.cell(rows[key],col).value or '') for col in (2,3,4,5))+
                               '\nRun ID: '+run_id+'; test-results.json SHA-256: '+results_sha256+
                               '\nD=deadline. Scope: '+', '.join(scopes[key]['functionNames']) for key in group3_ids}
            tchanges={sheet_parts(template_data)['Q1_Unit test-case']:dict(values={},caches={},heights={},styles={},widths={})}
            details=append_requirement_matrices(root,matrix,next(iter(tchanges.values())),
                {key:grouped[key] for key in group3_ids},scopes,model['functions'],results,creator,
                template.epoch,template_data,requirement_texts,start)
            details['preservedRange']=f'A1:{get_column_letter(matrix.max_column)}{start-1}'
            details['preservedMatrices']=preserved
            details['totalTagged']=sum(len(v) for v in grouped.values())
        elif group2_ids:
            # Existing UT-001..005 matrices are immutable in this session, including
            # their historical dates, coverage notes, cell styles, formulas and merges.
            existing={str(matrix.cell(r,3).value):r for r in range(2,matrix.max_row+1)
                      if re.fullmatch(r'UT-\d{3}',str(matrix.cell(r,3).value))}
            if not all(key in existing for key in ('UT-001','UT-002','UT-003','UT-004','UT-005')):
                raise ValueError('Expected the five original matrices before appending Group 2.')
            endings=[r for r in range(46,matrix.max_row+1) if matrix.cell(r,1).value==MATRIX_END]
            if len(endings)!=1:raise ValueError('Cannot identify a unique managed matrix boundary.')
            start=existing['UT-006']-1 if 'UT-006' in existing else endings[0]
            if any(existing[key]>=start for key in ('UT-001','UT-002','UT-003','UT-004','UT-005')):
                raise ValueError('Group 2 would overlap an original matrix.')
            requirement_texts={key: ' | '.join(str(sheet.cell(rows[key],col).value or '').replace('\\n','; ')
                               for col in (2,3,4)) for key in group2_ids}
            tchanges={sheet_parts(template_data)['Q1_Unit test-case']:
                      dict(values={},caches={},heights={},styles={},widths={})}
            details=append_requirement_matrices(root,matrix,next(iter(tchanges.values())),
                {key:grouped[key] for key in group2_ids},scopes,model['functions'],results,creator,
                template.epoch,template_data,requirement_texts,start)
            details['preservedRange']=f'A1:{get_column_letter(matrix.max_column)}{start-1}'
            details['preservedMatrices']=['UT-001','UT-002','UT-003','UT-004','UT-005']
            details['totalTagged']=sum(len(v) for v in grouped.values())
        else:
            details=append_requirement_matrices(root,matrix,next(iter(tchanges.values())),grouped,scopes,model['functions'],results,creator,template.epoch,template_data)
        summary = {'requirements':statuses,'round1':{s:counts[s] for s in ('Passed','Failed','Pending','N/A')},'matrixCases':len(model['cases']),
                   'branchLogin':login_coverage,'branchAll':global_coverage,'functions':model['functions'],
                   'matrix':model['cases'],'sourceTest':str(source.relative_to(root)),
                   'scopes':scopes,'additionalExecutions':details,'group2SourceSHA256':group2_sources,'group3SourceSHA256':group3_sources,
                   'group4SourceSHA256':group4_sources,
                   'group5SourceSHA256':group5_sources,
                   'group6SourceSHA256':group6_sources,
                   'branchGroup6':branch_coverage(coverage,[f for f in model['functions'] if f['name']=='attemptView']) if group6_ids else None,
                   'branchGroup5':branch_coverage(coverage,[f for f in model['functions'] if f['name'] in
                       {'AttemptsService.submit','AttemptsService.finalize'}]) if group5_ids else None,
                   'branchGroup4':branch_coverage(coverage,[f for f in model['functions'] if f['name'] in {
                       name for key in group4_ids for name in group4_scope_names[key]}]) if group4_ids else None,
                   'functionCoverage':[{**f,'branch':branch_coverage(coverage,[f])} for f in model['functions']]}
        return changes, tchanges, summary
    finally:
        report.close()
        template.close()
        cached_report.close()


def verify_requirement_matrices(before_data, after_data, summary):
    details=summary['additionalExecutions']
    if not details.get('preservedMatrices'):return
    before=load_workbook(io.BytesIO(before_data)); after=load_workbook(io.BytesIO(after_data))
    cached=load_workbook(io.BytesIO(after_data),data_only=True)
    try:
        old=before['Q1_Unit test-case']; new=after['Q1_Unit test-case']; calc=cached[new.title]
        boundary=min(b['start'] for b in details['matrices'])
        # Compare native cells/styles/formulas and merges, in addition to ZIP preservation.
        for row in old.iter_rows(max_row=boundary-1):
            for c in row:
                n=new[c.coordinate]
                if (c.value,c.data_type,c.style_id)!=(n.value,n.data_type,n.style_id):
                    raise ValueError(f'Original matrix changed: {c.coordinate}')
        if {str(m) for m in old.merged_cells.ranges if m.max_row<boundary}!={str(m) for m in new.merged_cells.ranges if m.max_row<boundary}:
            raise ValueError('An original matrix merge changed')
        codes=[new.cell(r,3).value for r in range(2,new.max_row+1)]
        expected_ids=[*details['preservedMatrices'],*[b['requirement'] for b in details['matrices']]]
        for key in expected_ids:
            if codes.count(key)!=1:raise ValueError(f'Missing/duplicate matrix: {key}')
        for block in details['matrices']:
            key=block['requirement']; records=[c for c in details['records'] if c['requirement']==key]
            start=block['start'];extra=block['extra'];offset=start-1
            def at(col,row):return f'{col}{offset+row+(extra if row>=31 else 0)}'
            counts=Counter(c['status'] for c in records)
            for i,record in enumerate(records,1):
                col=record['column']
                if new[at(col,9)].value!=f'UTCID{i:02d}':raise ValueError('UTCID column mismatch')
                for j,(field,value) in enumerate(block['conditions']):
                    row=start+10+j
                    if new[f'B{row}'].value!=field or new[f'D{row}'].value!=value:
                        raise ValueError('Input condition label mismatch')
                    expected='O' if record['vector'].get(field)==value else None
                    if new[f'{col}{row}'].value!=expected:raise ValueError(f'O mark mismatch: {key}/{col}/{field}')
                if new[at(col,40)].value!={'passed':'P','failed':'F'}.get(record['status']):
                    raise ValueError('Matrix status differs from Jest')
                expected_outputs={32:'O' if record['resolves'] else None,
                    33:None if record['resolves'] else 'O',34:record['http'],35:record['code'],39:record['category']}
                expected_outputs.update({r:'O' if record['confirms'].get(label) else None
                                         for r,label in enumerate(block['confirmLabels'],36)})
                for row,value in expected_outputs.items():
                    if new[at(col,row)].value!=value:raise ValueError(f'Confirm/Return/Exception differs: {key}/{col}/{row}')
                date=new[at(col,41)].value
                if not isinstance(date,datetime) or date.date().isoformat()!=record['executedDate']:
                    raise ValueError(f'Executed date differs from Jest: {key}/{col}')
            types=Counter(new[at(c['column'],39)].value for c in records)
            expected={'A':counts['passed'],'C':counts['failed'],'F':len(records)-counts['passed']-counts['failed'],
                      'L':types['N'],'M':types['A'],'N':types['B'],'O':len(records)}
            last=get_column_letter(5+len(records));status_row=block['statusRow']
            type_row=status_row-1;header=block['headerRow'];summary_row=start+6
            formulas={'A':f'COUNTIF(F{status_row}:{last}{status_row},"P")',
                'C':f'COUNTIF(F{status_row}:{last}{status_row},"F")',
                'F':f'SUM(O{summary_row},-A{summary_row},-C{summary_row})',
                'L':f'COUNTIF(F{type_row}:{last}{type_row},"N")',
                'M':f'COUNTIF(F{type_row}:{last}{type_row},"A")',
                'N':f'COUNTIF(F{type_row}:{last}{type_row},"B")',
                'O':f'COUNTA(F{header}:{last}{header})'}
            for col,formula in formulas.items():
                if new[at(col,7)].value!='='+formula:
                    raise ValueError(f'Matrix summary formula mismatch: {key}/{col}')
            for col,value in expected.items():
                if new[at(col,7)].data_type!='f' or calc[at(col,7)].value!=value:
                    raise ValueError(f'Matrix summary cache/formula mismatch: {key}/{col}')
        summary['matrixValidation']={'originalMatricesUnchanged':True,'uniqueMatrices':len(expected_ids),
            'newCases':details['count'],'conditionMarksMatchDataset':True,'formulaCachesVerified':True,
            'allSevenSummaryFormulasVerified':True,'executedDatesVerified':True}
    finally:
        before.close();after.close();cached.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--results', default='test-results.json')
    parser.add_argument('--report', default='docs/Test Report.xlsx')
    parser.add_argument('--template', default='docs/SWT301-FINAL-PE-template.xlsx')
    parser.add_argument('--creator', default='AI/Huy')
    parser.add_argument('--dry-run', action='store_true', help='Create validated staging copies, without replacing originals.')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    targets = [workbook_path(root, args.report), workbook_path(root, args.template)]
    if len(set(targets)) != 2:
        raise ValueError('The report and template must be different workbooks.')
    result_path = (root / args.results).resolve()
    result_bytes = result_path.read_bytes()
    results = json.loads(result_bytes.decode('utf-8-sig'))
    if results.get('wasInterrupted') or results.get('numTotalTests', 0) == 0:
        raise ValueError('Jest execution was interrupted or contains no tests.')
    original = [p.read_bytes() for p in targets]
    run_dir = root / 'tmp' / ('unit-report-' + datetime.now(TZ).strftime('%Y%m%d-%H%M%S-%f'))
    (run_dir / 'before').mkdir(parents=True)
    (run_dir / 'staged').mkdir()
    for path, content in zip(targets, original):
        backup = run_dir / 'before' / path.name
        backup.write_bytes(content)
        if digest(backup.read_bytes()) != digest(content):
            raise IOError('Backup verification failed.')
    changes1, changes2, summary = build_updates(root, results, *original, args.creator, digest(result_bytes))
    updated = []
    for path, content, changes in zip(targets, original, [changes1, changes2]):
        output = rewrite(content, changes)
        verify_preservation(content, output, changes)
        staged = run_dir / 'staged' / path.name
        staged.write_bytes(output)
        # Reopen with independent, formula-aware and cached-value-aware readers.
        for data_only in (False,True):
            reopened = load_workbook(staged, data_only=data_only, keep_links=True)
            reopened.close()
        updated.append(output)
    verify_requirement_matrices(original[1],updated[1],summary)
    summary.update({'results':str(result_path.relative_to(root)), 'resultsSHA256':digest(result_bytes),
                    'runId':datetime.fromtimestamp(results['startTime']/1000,TZ).strftime('%Y%m%d-%H%M%S'),
                    'backupDirectory':str(run_dir.relative_to(root)), 'committed':False,
                    'beforeSHA256':{p.name:digest(b) for p,b in zip(targets,original)}})
    manifest = run_dir / 'update-summary.json'
    manifest.write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    if args.dry_run:
        print(json.dumps({'dryRun':True,'summary':str(manifest),'requirements':summary['requirements'],'round1':summary['round1']},ensure_ascii=True))
        return
    # Preflight both targets before the first replacement. An open Excel workbook is
    # reported without changing either original. Check hashes again for concurrent edits.
    for path, content in zip(targets,original):
        if digest(path.read_bytes()) != digest(content):
            raise IOError(f'Workbook changed during preparation: {path}')
        try:
            with path.open('r+b'):
                pass
        except PermissionError as error:
            raise PermissionError(f'Close this workbook in Excel and rerun: {path}. Validated staging/backup: {run_dir}') from error
    replaced, pending = [], []
    try:
        for path, content in zip(targets, updated):
            with tempfile.NamedTemporaryFile(dir=path.parent, prefix='unit-report-', suffix='.xlsx', delete=False) as handle:
                temporary = Path(handle.name)
                handle.write(content)
            pending.append(temporary)
            if not temporary.resolve().is_relative_to(root):
                raise ValueError('Temporary output escaped the repository.')
            os.replace(temporary, path)
            replaced.append(path)
        for path, content in zip(targets, updated):
            if digest(path.read_bytes()) != digest(content):
                raise IOError(f'Post-save hash mismatch: {path}')
    except Exception:
        for path, content in zip(targets, original):
            if path in replaced:
                path.write_bytes(content)
        raise
    finally:
        for path in pending:
            if path.exists():
                path.unlink()
    summary['committed'] = True
    summary['afterSHA256'] = {p.name:digest(b) for p,b in zip(targets,updated)}
    manifest.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'updated':[str(p.relative_to(root)) for p in targets], 'requirements':summary['requirements'],
                      'round1':summary['round1'],'matrixCases':summary['matrixCases'],'branchLogin':summary['branchLogin'],
                      'branchAll':summary['branchAll'],'additionalCases':summary['additionalExecutions']['count'],
                      'executedCases':summary['additionalExecutions']['totalTagged'],'summary':str(manifest)},ensure_ascii=True))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'ERROR: {error}', file=sys.stderr)
        raise SystemExit(1)
