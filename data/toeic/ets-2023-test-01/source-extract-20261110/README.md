# TEST 1 - source extraction package

This is a local source-processing export, not an approved import dataset.

- `text/listening.txt`, `text/reading.txt`: questions in source-number order. Existing edited wording is reused where available; the rest is unreviewed OCR.
- `text/*pages.raw-ocr.txt`: complete page OCR, including directions. OCR engine reading order is retained for traceability.
- `text/answer-key.txt`, `answer-key.csv/json`: 200 choices checked against the supplied answer image; this does not certify audio or semantic correctness for every question.
- `questions.json`: 200 question records, source page/region, options, image/audio references and explicit quality status.
- `image-mapping.csv/json`: 6 assessed Part 1 photos, 5 Listening graphics, 1 example photo, 4 Part 6 passages and 23 Part 7 documents, with crop provenance and document order.
- `images/pdf-streams` and `pdf-image-streams.json`: original embedded image streams. The scanned PDFs use horizontal strips, so these are not individual question figures. `images/assets` contains the usable semantic crops.
- `audio-mapping.csv/json`: one full Listening file plus 54 clips. `question-audio.csv` expands the clips to 100 question rows. Part 3/4 share one clip per group.
- `groups.json` and `passages`: ordered passage images and extracted text. Tables retain their source layout in the images; raw OCR text is not a faithful table renderer.
- Audio files and source PDFs remain at their repository-relative paths under `docs/TEST 1`; the package does not duplicate them. Resolve `file` against the repository root, and `imageFile` against this package directory.
- Full audio belongs to the full Listening sequence, not an arbitrary question. Current Test DTO/player integration is a separate task; no fabricated time offsets are provided.
- Questions 1-31 have spoken stems/options. Their absent printed text is intentional; audio transcripts have not been invented.
- No database, importer checkpoint, existing dataset approval, audio approval or learner progress was changed. No OCR or builder was rerun.

Review `ocr-review-queue.json` and `validation.json` before authoring/importing. This export alone does not authorize full import or publication.
