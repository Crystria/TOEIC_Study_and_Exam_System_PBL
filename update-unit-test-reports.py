#!/usr/bin/env python3
"""Update the two existing Excel reports from Jest evidence, without re-saving their styles.

Run at repository root: python update-unit-test-reports.py
Requires Python 3.10+, openpyxl, lxml and Node with this repository's TypeScript dependency.
If the desktop's bundled Python is available, it is used automatically when needed.
Only explicit UT identifiers are mapped. Untagged tests never complete a requirement.
The UT-001 input matrix is preserved; other explicitly tagged executions are listed
below it on the same sheet. Ambiguous mappings stop the update before originals change.
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


def managed_merge(reference, start, end):
    left, top, right, bottom = range_boundaries(reference)
    return left >= 1 and right <= 27 and top >= start and bottom <= end


def patch_sheet(data: bytes, values: dict, caches: dict, heights: dict, styles: dict, widths=None, merges=None, merge_from=None, merge_until=None) -> bytes:
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
        if isinstance(value, (int, float)):
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
            if managed_merge(item.get('ref'),merge_from,merge_until):
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
            for tree in (a, b):
                for c in tree.findall('.//s:sheetData/s:row/s:c', NS):
                    if c.get('r') in changes[entry]['values'] or c.get('r') in changes[entry]['caches']:
                        # Preserve every existing cell style, even when its value changes.
                        original = a.find(f".//s:c[@r='{c.get('r')}']", NS)
                        updated = b.find(f".//s:c[@r='{c.get('r')}']", NS)
                        if original is not None and updated is not None and original.get('s') != updated.get('s') and c.get('r') not in changes[entry]['styles']:
                            raise ValueError(f'Existing cell style changed: {c.get("r")}')
            # Only the filled matrix cells may reuse reference styles; all other style
            # records and workbook parts remain byte-for-byte identical.
            for address, reference in changes[entry]['styles'].items():
                expected = a.find(f".//s:c[@r='{reference}']", NS)
                actual = b.find(f".//s:c[@r='{address}']", NS)
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
                        if managed_merge(item.get('ref'),changes[entry]['merge_from'],changes[entry]['merge_until']):
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


def append_execution_details(matrix, plan, grouped, scopes, results, creator):
    """Keep the original input matrix and append real UT-002+ execution records.

    The block owns only A46:AA<end>. A marker protects existing manual content;
    subsequent runs replace its records rather than duplicating them.
    """
    start = 46
    extra_ids = sorted(case_id for case_id in grouped if case_id != 'UT-001')
    if matrix['A46'].value not in (None, DETAIL_TITLE):
        raise ValueError('A46 already contains unrelated content; refusing to overwrite it.')
    if matrix['A46'].value is None:
        for row in matrix.iter_rows(min_row=start,max_row=max(start,matrix.max_row),max_col=27):
            if any(c.value is not None for c in row):
                raise ValueError('The template has manual content below the matrix.')
    old_end = start-1
    if matrix['A46'].value == DETAIL_TITLE:
        old_end=start+3
        for scan in range(start+4,matrix.max_row+1):
            label=str(matrix[f'A{scan}'].value or '')
            number=str(matrix[f'B{scan}'].value or '')
            generated_record=bool(re.fullmatch(r'UT-\d{3}',label) and re.fullmatch(r'UTCID\d+',number))
            generated_header=bool(re.match(r'^UT-\d{3} \| ',label) and matrix[f'F{scan}'].value is None)
            if not (generated_record or generated_header):
                break
            old_end=scan
    values, styles, heights, merges = plan['values'],plan['styles'],plan['heights'],[]

    def prepare(row, header=False, height=24):
        heights[row]=height
        for column in range(1,28):
            address=f'{get_column_letter(column)}{row}'
            values[address]=None
            styles[address]='A6' if header else 'C3'

    def full_row(row,text,header=False):
        prepare(row,header)
        values[f'A{row}']=text
        merges.append(f'A{row}:AA{row}')

    all_outcomes=Counter(a['status'] for items in grouped.values() for s,a in items)
    all_count=sum(all_outcomes.values())
    extra_count=sum(len(grouped[case_id]) for case_id in extra_ids)
    full_row(start,DETAIL_TITLE,True)
    full_row(start+1,f"Tổng {all_count} tình huống gắn mã UT: Passed {all_outcomes['passed']}; Failed {all_outcomes['failed']}; Pending {all_count-all_outcomes['passed']-all_outcomes['failed']}. Ma trận UT-001 ở trên; {extra_count} tình huống mới ở dưới.")
    run_time=datetime.fromtimestamp(results['startTime']/1000,TZ).strftime('%d/%m/%Y %H:%M:%S')
    full_row(start+2,f'Nguồn: test-results.json; lần chạy {run_time} (UTC+7); người lập: {creator}. Branch là coverage hàm trong toàn lượt chạy.')
    row=start+3
    prepare(row,True)
    for col,text in [('A','UT ID'),('B','Test Case'),('F','Tình huống Jest đã thực thi'),('U','Round 1'),('X','Branch hàm')]:
        values[f'{col}{row}']=text
    merges.extend([f'B{row}:D{row}',f'F{row}:T{row}',f'U{row}:W{row}',f'X{row}:AA{row}'])
    ordinal=len(grouped['UT-001'])
    records=[]
    for case_id in extra_ids:
        assertions=grouped[case_id]
        counts=Counter(a['status'] for s,a in assertions)
        scope=scopes.get(case_id)
        label=scope['name'] if scope else 'chức năng theo mã UT'
        row+=1
        full_row(row,f"{case_id} | {label} | Passed {counts['passed']} / Failed {counts['failed']} / Pending {len(assertions)-counts['passed']-counts['failed']}",True)
        for suite,assertion in assertions:
            row+=1; ordinal+=1
            prepare(row)
            state={'passed':'Passed','failed':'Failed'}.get(assertion['status'],'Pending')
            pct=scope['coverage']['pct'] if scope else None
            values[f'A{row}']=case_id
            values[f'B{row}']=f'UTCID{ordinal:02d}'
            values[f'F{row}']=assertion['title']
            values[f'U{row}']=state
            values[f'X{row}']=f'{pct:g}%' if pct is not None else 'N/A'
            merges.extend([f'B{row}:D{row}',f'F{row}:T{row}',f'U{row}:W{row}',f'X{row}:AA{row}'])
            records.append({'row':row,'requirement':case_id,'case':f'UTCID{ordinal:02d}','title':assertion['title'],'status':state})
    # Clear stale records if a later run contains fewer scenarios, preserving their styles.
    for check in matrix.iter_rows(min_row=max(start,old_end+1),max_row=max(row,old_end),max_col=27):
        if any(c.value is not None for c in check):
            raise ValueError('New execution records would overwrite manual content below the managed table.')
    for stale in range(row+1,old_end+1):
        for column in range(1,28):
            values[f'{get_column_letter(column)}{stale}']=None
    plan.update(merges=merges,merge_from=start,merge_until=max(row,old_end))
    return {'count':extra_count,'totalTagged':all_count,'range':f'A46:AA{row}','records':records}


def build_updates(root, results, report_data, template_data, creator):
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
        actual = {a['title']: (s, a) for s, a in grouped['UT-001']}
        if len(actual) != len(grouped['UT-001']) or set(actual) != {c['title'] for c in model['cases']}:
            raise ValueError('Executed assertions do not match current test-source scenarios.')
        for case in model['cases']:
            suite, assertion = actual[case['title']]
            case['execution'] = assertion['status']
            case['executedAt'] = suite.get('endTime', results['startTime'])
        coverage = results.get('coverageMap', {})
        global_coverage = branch_coverage(coverage)
        login_functions=[f for f in model['functions'] if f['name'] not in ('AuthService.refresh','ContractPipe.transform')]
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
        values, caches = {}, {}
        current = {case_id: str(sheet.cell(row, 6).value) for case_id, row in rows.items()}
        statuses = {}
        for case_id, assertions in grouped.items():
            outcomes = [a['status'] for s, a in assertions]
            status = 'Failed' if 'failed' in outcomes else 'Passed' if all(v == 'passed' for v in outcomes) else 'Pending'
            statuses[case_id] = current[case_id] = status
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
            run_id = datetime.fromtimestamp(results['startTime'] / 1000, TZ).strftime('%Y%m%d-%H%M%S')
            note = f"[JEST Round 1] {status}: {outcomes.count('passed')}/{len(outcomes)} passed; branch {scope}toàn lượt {global_coverage['pct']:g}%; file: test-results.json; run: {run_id}."
            values[f'O{row}'] = '\n'.join([*kept, note])
        counts = Counter(current.values())
        for column, status in [('B', 'Passed'), ('C', 'Failed'), ('D', 'Pending'), ('E', 'N/A')]:
            caches[f'{column}6'] = counts[status]
        caches['B4'] = len(rows)
        report_parts = sheet_parts(report_data)
        changes = {report_parts['Unit test']: dict(values=values, caches=caches, heights={}, styles={})}
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
        details=append_execution_details(matrix,next(iter(tchanges.values())),grouped,scopes,results,creator)
        summary = {'requirements':statuses,'round1':{s:counts[s] for s in ('Passed','Failed','Pending','N/A')},'matrixCases':len(model['cases']),
                   'branchLogin':login_coverage,'branchAll':global_coverage,'functions':model['functions'],
                   'matrix':model['cases'],'sourceTest':str(source.relative_to(root)),
                   'scopes':scopes,'additionalExecutions':details}
        return changes, tchanges, summary
    finally:
        report.close()
        template.close()
        cached_report.close()


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
    changes1, changes2, summary = build_updates(root, results, *original, args.creator)
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
    summary.update({'results':str(result_path.relative_to(root)), 'resultsSHA256':digest(result_bytes),
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
