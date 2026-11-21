import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseVocabularyClipboard } from '../src/lib/integration/vocabulary-clipboard';

test('Excel paste retains column positions and skips the final row delimiter', () => {
  assert.deepEqual(
    parseVocabularyClipboard('ledger\t\tSổ cái\t\r\ninvoice\t/ˈɪnvɔɪs/\tHóa đơn\tPay it.\r\n'),
    [
      ['ledger', '', 'Sổ cái', ''],
      ['invoice', '/ˈɪnvɔɪs/', 'Hóa đơn', 'Pay it.'],
    ],
  );
});

test('Excel paste preserves quoted tabs, line breaks, and escaped quotes inside a cell', () => {
  assert.deepEqual(
    parseVocabularyClipboard('schedule\t\t"Danh sách\tcông việc\r\nHằng ngày"\t"Say ""hello""."'),
    [['schedule', '', 'Danh sách\tcông việc\r\nHằng ngày', 'Say "hello".']],
  );
});

test('Excel paste keeps internal blank rows and a final blank cell without a newline', () => {
  assert.deepEqual(parseVocabularyClipboard('first\n\nthird\t'), [['first'], [''], ['third', '']]);
  assert.deepEqual(parseVocabularyClipboard('first\r\r'), [['first'], ['']]);
  assert.deepEqual(parseVocabularyClipboard('\t\t\t\n'), [['', '', '', '']]);
});

test('plain and unmatched quotes remain literal outside shared clipboard quoting', () => {
  assert.deepEqual(parseVocabularyClipboard('  She said "yes".  '), [['  She said "yes".  ']]);
  assert.deepEqual(parseVocabularyClipboard('"unclosed\tdefinition\nnext'), [
    ['"unclosed', 'definition'],
    ['next'],
  ]);
});
