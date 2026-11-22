// One-based original PDF page references; these are provenance, not content approval.
module.exports = function sourcePages(number) {
  if (number <= 6) return { code: '11', pages: [3 + Math.floor((number - 1) / 2)] };
  if (number <= 31) return { code: '11', pages: [6] }; // Questions/options are spoken, not printed here.
  for (const [a, b, page] of [
    [32, 43, 7],
    [44, 55, 8],
    [56, 64, 9],
    [65, 70, 10],
    [71, 82, 11],
    [83, 94, 12],
    [95, 100, 13],
  ])
    if (number >= a && number <= b) return { code: '11', pages: [page] };
  for (const [a, b, pages] of [
    [101, 108, [2]],
    [109, 120, [3]],
    [121, 130, [4]],
    [131, 134, [5]],
    [135, 138, [6]],
    [139, 142, [7]],
    [143, 146, [8]],
    [147, 148, [9]],
    [149, 150, [10]],
    [151, 153, [11]],
    [154, 155, [12]],
    [156, 157, [13]],
    [158, 161, [14, 15]],
    [162, 165, [16, 17]],
    [166, 168, [18]],
    [169, 171, [19]],
    [172, 175, [20, 21]],
    [176, 180, [22, 23]],
    [181, 185, [24, 25]],
    [186, 190, [26, 27]],
    [191, 195, [28, 29]],
    [196, 200, [30, 31]],
  ])
    if (number >= a && number <= b) return { code: '12', pages };
  throw Error('Source question number must be 1..200');
};
