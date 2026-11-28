"""Export source text, original PDF image streams, crops and audio mappings.

Reads the existing OCR cache. Never rebuilds/imports/approves the live dataset.
"""
import argparse
import csv
import gzip
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageDraw
from pypdf import PdfReader


ROOT = Path('data/toeic/ets-2023-test-01')
CACHE = Path('tmp/real-content-20261110-102636-453/ocr')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def write_csv(path, fields, rows):
    with path.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: json.dumps(row.get(key), ensure_ascii=False) if isinstance(row.get(key), (list, dict)) else row.get(key) for key in fields})


def word_lines(words):
    """Reconstruct rows by baseline, not the OCR engine's paragraph ordering."""
    rows = []
    for word in sorted(words, key=lambda w: (w['y'] + w['height'] / 2, w['x'])):
        center = word['y'] + word['height'] / 2
        if rows and abs(center - rows[-1]['center']) <= 14:
            rows[-1]['words'].append(word)
        else:
            rows.append(dict(center=center, words=[word]))
    return [' '.join(w['text'] for w in sorted(row['words'], key=lambda w: w['x'])) for row in rows]


def write_exam_text(out, questions, dataset):
    groups = {g['sourceId']: g for g in dataset['groups']}
    assets = json.loads((out / 'image-mapping.json').read_text(encoding='utf-8'))
    for lower, upper, name in [(1,100,'listening.txt'),(101,200,'reading.txt')]:
        lines = ['TEST 1 - EXTRACTED SOURCE TEXT', 'OCR source export; unreviewed wording is not import-ready. Answers are in answer-key.txt.', '']
        printed_groups = set()
        for row in questions[lower-1:upper]:
            group_id = row.get('groupSourceId')
            if group_id and row['part'] >= 6 and group_id not in printed_groups:
                group = groups[group_id]
                lines.append(f"PASSAGE - QUESTIONS {group['questionNumbers'][0]}-{group['questionNumbers'][-1]}")
                if group['quality'].get('textReviewed'):
                    payload = group['payload']
                    if payload.get('passageText'):
                        content = payload['passageText']
                        for i, n in enumerate(group['questionNumbers'],1):
                            content = content.replace('[['+str(i)+']]',f'_______ ({n})')
                        lines.append(content)
                    for asset in sorted(payload.get('assets',[]),key=lambda x:x['orderNo']):
                        if asset['kind'] == 'TEXT':
                            lines.append(f"[Document {asset['orderNo']}]\n"+asset['content'])
                else:
                    for asset in sorted([a for a in assets if a['role']=='PASSAGE_DOCUMENT' and a['questionNumbers']==group['questionNumbers']],key=lambda a:a['documentOrder']):
                        lines.append(f"[Document {asset['documentOrder']}; unreviewed OCR]\n"+(out/asset['ocrTextFile']).read_text(encoding='utf-8'))
                printed_groups.add(group_id)
                lines.append('')
            lines.append(f"{row['questionNumber']:03d}. [Part {row['part']}; PDF pages {row['source']['pdfPages']}]")
            if row['questionNumber'] < 32:
                lines.append('[Spoken question/options: use the mapped original clip. No printed statement in the PDF.]')
            elif row.get('existingEditedPayload'):
                payload = row['existingEditedPayload']
                lines.append(payload.get('questionText') or f"Blank {row['questionNumber']}")
                lines.extend(f"({o['optionCode']}) {o['optionText']}" for o in payload['options'])
            elif [o['optionCode'] for o in row['printedOptions']] == list('ABCD'):
                lines.append(row['printedQuestionText'] or f"[Blank {row['questionNumber']}]")
                lines.extend(f"({o['optionCode']}) {o['optionText']}" for o in row['printedOptions'])
            else:
                lines.append(row['rawQuestionBlock'] or '[OCR anchor missing; inspect source page]')
            if row['imageAssetIds']:
                lines.append('Images/passages: ' + ', '.join(row['imageAssetIds']))
            if row['audioClipId']:
                lines.append('Audio: ' + row['audioClipId'])
            lines.append('')
        (out/'text'/name).write_text('\n'.join(lines),encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', required=True, help='A NEW output directory')
    parser.add_argument('--evidence', required=True)
    args = parser.parse_args()
    out, evidence = Path(args.out), Path(args.evidence)
    if out.exists():
        raise ValueError('Output already exists; choose a new directory, never overwrite a reviewed package')
    if list(evidence.glob('assets-contact-*.jpg')):
        raise ValueError('Image review evidence already exists; choose a new evidence directory')
    evidence.mkdir(parents=True, exist_ok=True)
    source = Path('docs/TEST 1')
    protected = {p: digest(p.read_bytes()) for p in [ROOT / n for n in ['dataset.json', 'answer-key.json', 'source-inventory.json', 'review-queue.json', 'import-state.local.json', 'ocr-pages.json.gz']]}
    dataset = json.loads((ROOT / 'dataset.json').read_text(encoding='utf-8'))
    inventory = json.loads((ROOT / 'source-inventory.json').read_text(encoding='utf-8'))
    answer_key = json.loads((ROOT / 'answer-key.json').read_text(encoding='utf-8'))
    pages = json.loads(gzip.decompress((ROOT / 'ocr-pages.json.gz').read_bytes()))
    page_index = {(p['code'], p['pdfPage']): p for p in pages}
    exam_sources = {code: next(p for p in source.glob('*.pdf') if p.name.startswith(prefix)) for code, prefix in [('11', '1.1.'), ('12', '1.2.')]}
    for code, pdf in exam_sources.items():
        expected = next(f for f in inventory['files'] if Path(f['file']) == pdf)
        if digest(pdf.read_bytes()) != expected['sha256']:
            raise ValueError(f'Source changed; cached OCR cannot be trusted for {code}')
    # A second visual transcription from the supplied answer image, not a semantic
    # proof that an unheard recording has the claimed answer.
    listening_rows = ['DCBCD','ABABC','ABACA','CBBCA','CCBAB','ACACB','BADCC','ABABD','CBDCD','BBADC','DACCA','ABACB','AADBD','CABDD','CDBCD','BCABD','CADAA','BDCAB','DDCBA','DCCBB']
    reading_rows = ['CBABD','DABCD','CBDDA','BBACD','BCDBD','ABBCB','BCCAD','ACDAA','DDBDA','CABBC','CBDDC','CDCBC','AABDD','CADAC','CBCDA','CABDC','ABBDD','CACBA','BBDAD','CADBC']
    visual_values = ''.join(listening_rows + reading_rows)
    if len(visual_values) != 200:
        raise ValueError('Independent answer-image transcription must contain 200 choices')
    mismatch = [n for n, choice in enumerate(visual_values, 1) if answer_key[n-1]['questionNumber'] != n or answer_key[n-1]['correctOption'] != choice]
    if mismatch:
        raise ValueError(f'Answer image transcription differs at {mismatch}; inspect before exporting')
    out.mkdir(parents=True)
    for folder in ['text', 'images/assets', 'images/pdf-streams', 'passages']:
        (out / folder).mkdir(parents=True)
    exported_keys = [dict(questionNumber=r['questionNumber'], correctOption=r['correctOption'], answerImageTranscriptionChecked=True, semanticAnswerCrossChecked=r.get('independentCrossCheck', False), source=r['source']) for r in answer_key]
    write_json(out / 'answer-key.json', exported_keys)
    write_csv(out / 'answer-key.csv', ['questionNumber', 'correctOption', 'answerImageTranscriptionChecked', 'semanticAnswerCrossChecked'], exported_keys)
    (out / 'text/answer-key.txt').write_text('\n'.join(f"{r['questionNumber']:03d}. {r['correctOption']}" for r in exported_keys) + '\n', encoding='utf-8')

    # Preserve every embedded stream. These PDFs store scanned pages as horizontal
    # image strips; a PDF image object is usually NOT an individual question photo.
    streams, unique_streams = [], {}
    pdf_info = []
    for code, pdf in exam_sources.items():
        reader = PdfReader(pdf)
        pdf_info.append(dict(code=code, file=str(pdf), sha256=digest(pdf.read_bytes()), pages=len(reader.pages), nativeTextCharacters=sum(len(p.extract_text() or '') for p in reader.pages)))
        raw = []
        for number, page in enumerate(reader.pages, 1):
            ocr = page_index[(code, number)]
            raw.append(f'=== PDF PAGE {number} / {pdf.name} ===\n' + '\n'.join(line['text'] for line in ocr['lines']))
            for image in page.images:
                sha = digest(image.data)
                if sha not in unique_streams:
                    target = out / 'images/pdf-streams' / (sha[:20] + Path(image.name).suffix.lower())
                    target.write_bytes(image.data)
                    unique_streams[sha] = target.relative_to(out).as_posix()
                streams.append(dict(sourcePdf=str(pdf), pdfPage=number, objectName=image.name, imageFile=unique_streams[sha], sha256=sha, width=image.image.width, height=image.image.height, role='ORIGINAL_PDF_SCAN_STRIP_OR_OVERLAY_NOT_SEMANTIC_CROP'))
        (out / ('text/listening-pages.raw-ocr.txt' if code == '11' else 'text/reading-pages.raw-ocr.txt')).write_text('\n\n'.join(raw) + '\n', encoding='utf-8')
    write_json(out / 'pdf-image-streams.json', streams)
    write_json(out / 'source-pdfs.json', pdf_info)

    # All assessed photos/graphics, the example photo, four Part 6 passages and
    # 23 Part 7 documents. Boxes use the existing 1932 x 2500 page renders.
    crop_specs = [
        ('part1-example', '11', 2, (390,860,1580,1620), [], 'EXAMPLE_PHOTO', 1),
        ('q001-photo','11',3,(570,150,1335,1260),[1],'QUESTION_PHOTO',1),
        ('q002-photo','11',3,(350,1440,1540,2280),[2],'QUESTION_PHOTO',1),
        ('q003-photo','11',4,(400,155,1590,1010),[3],'QUESTION_PHOTO',1),
        ('q004-photo','11',4,(400,1180,1590,2040),[4],'QUESTION_PHOTO',1),
        ('q005-photo','11',5,(360,150,1540,1020),[5],'QUESTION_PHOTO',1),
        ('q006-photo','11',5,(360,1180,1540,2045),[6],'QUESTION_PHOTO',1),
        ('g062-064-graphic','11',9,(1045,145,1665,680),list(range(62,65)),'LISTENING_GRAPHIC',1),
        ('g065-067-graphic','11',10,(270,140,855,600),list(range(65,68)),'LISTENING_GRAPHIC',1),
        ('g068-070-graphic','11',10,(1020,145,1665,615),list(range(68,71)),'LISTENING_GRAPHIC',1),
        ('g095-097-graphic','11',13,(245,145,890,550),list(range(95,98)),'LISTENING_GRAPHIC',1),
        ('g098-100-graphic','11',13,(1040,140,1665,655),list(range(98,101)),'LISTENING_GRAPHIC',1),
        ('g131-134-document-1','12',5,(280,635,1635,1405),list(range(131,135)),'PASSAGE_DOCUMENT',1),
        ('g135-138-document-1','12',6,(275,300,1650,1030),list(range(135,139)),'PASSAGE_DOCUMENT',1),
        ('g139-142-document-1','12',7,(270,305,1615,1390),list(range(139,143)),'PASSAGE_DOCUMENT',1),
        ('g143-146-document-1','12',8,(280,315,1650,1030),list(range(143,147)),'PASSAGE_DOCUMENT',1),
        ('g147-148-document-1','12',9,(470,645,1475,1395),list(range(147,149)),'PASSAGE_DOCUMENT',1),
        ('g149-150-document-1','12',10,(360,300,1650,965),list(range(149,151)),'PASSAGE_DOCUMENT',1),
        ('g151-153-document-1','12',11,(280,300,1635,900),list(range(151,154)),'PASSAGE_DOCUMENT',1),
        ('g154-155-document-1','12',12,(525,300,1405,1400),list(range(154,156)),'PASSAGE_DOCUMENT',1),
        ('g156-157-document-1','12',13,(340,300,1640,1245),list(range(156,158)),'PASSAGE_DOCUMENT',1),
        ('g158-161-document-1','12',14,(350,300,1645,1400),list(range(158,162)),'PASSAGE_DOCUMENT',1),
        ('g162-165-document-1','12',16,(360,300,1650,1410),list(range(162,166)),'PASSAGE_DOCUMENT',1),
        ('g166-168-document-1','12',18,(340,300,1625,1240),list(range(166,169)),'PASSAGE_DOCUMENT',1),
        ('g169-171-document-1','12',19,(340,300,1585,1005),list(range(169,172)),'PASSAGE_DOCUMENT',1),
        ('g172-175-document-1','12',20,(275,290,1645,1080),list(range(172,176)),'PASSAGE_DOCUMENT',1),
        ('g176-180-document-1','12',22,(450,300,1550,1190),list(range(176,181)),'PASSAGE_DOCUMENT',1),
        ('g176-180-document-2','12',22,(360,1230,1650,2115),list(range(176,181)),'PASSAGE_DOCUMENT',2),
        ('g181-185-document-1','12',24,(360,300,1650,1200),list(range(181,186)),'PASSAGE_DOCUMENT',1),
        ('g181-185-document-2','12',24,(380,1280,1575,1920),list(range(181,186)),'PASSAGE_DOCUMENT',2),
        ('g186-190-document-1','12',26,(370,105,1595,775),list(range(186,191)),'PASSAGE_DOCUMENT',1),
        ('g186-190-document-2','12',26,(335,800,1640,1540),list(range(186,191)),'PASSAGE_DOCUMENT',2),
        ('g186-190-document-3','12',27,(370,245,1545,990),list(range(186,191)),'PASSAGE_DOCUMENT',3),
        ('g191-195-document-1','12',28,(430,300,1600,920),list(range(191,196)),'PASSAGE_DOCUMENT',1),
        ('g191-195-document-2','12',28,(360,975,1650,1840),list(range(191,196)),'PASSAGE_DOCUMENT',2),
        ('g191-195-document-3','12',29,(530,255,1415,805),list(range(191,196)),'PASSAGE_DOCUMENT',3),
        ('g196-200-document-1','12',30,(675,300,1250,1250),list(range(196,201)),'PASSAGE_DOCUMENT',1),
        ('g196-200-document-2','12',30,(350,1330,1650,2245),list(range(196,201)),'PASSAGE_DOCUMENT',2),
        ('g196-200-document-3','12',31,(350,175,1650,1095),list(range(196,201)),'PASSAGE_DOCUMENT',3),
    ]
    assets = []
    for name, code, number, box, numbers, role, order in crop_specs:
        image = Image.open(CACHE / code / f'page-{number:03d}.png')
        page = page_index[(code, number)]
        if image.size != (page['width'], page['height']):
            raise ValueError('Cached image/OCR dimensions differ')
        target = out / 'images/assets' / (name + '.png')
        image.crop(box).save(target)
        words = [w for line in page['lines'] for w in line['words'] if box[0] <= w['x'] + w['width']/2 < box[2] and box[1] <= w['y'] + w['height']/2 < box[3]]
        entry = dict(assetId=name, imageFile=target.relative_to(out).as_posix(), sha256=digest(target.read_bytes()), sourcePdf=str(exam_sources[code]), pdfPage=number, pageSize=list(image.size), cropPixels=list(box), questionNumbers=numbers, role=role, documentOrder=order, layoutReviewed=False)
        if role == 'PASSAGE_DOCUMENT':
            text_file = out / 'passages' / (name + '.raw-ocr.txt')
            if name in ['g151-153-document-1','g172-175-document-1']:
                split = (box[0]+box[2])/2
                content = '\n'.join(word_lines([w for w in words if w['x']<split]))+'\n\n'+'\n'.join(word_lines([w for w in words if w['x']>=split]))
                entry['textLayout'] = 'LEFT_COLUMN_THEN_RIGHT_COLUMN'
            else:
                content = '\n'.join(word_lines(words))
                entry['textLayout'] = 'SINGLE_DOCUMENT_ROWS; TABLES_REQUIRE_IMAGE_OR_REVIEWED_MARKDOWN'
            text_file.write_text(content + '\n', encoding='utf-8')
            entry['ocrTextFile'] = text_file.relative_to(out).as_posix()
        assets.append(entry)
    write_json(out / 'image-mapping.json', assets)
    write_csv(out / 'image-mapping.csv', ['assetId','imageFile','questionNumbers','documentOrder','role','sourcePdf','pdfPage','cropPixels','sha256'], assets)

    audio = []
    for entry in inventory['files']:
        if not entry['file'].lower().endswith('.mp3'):
            continue
        file = Path(entry['file'])
        if digest(file.read_bytes()) != entry['sha256']:
            raise ValueError('Audio source hash changed')
        full = 'questionNumbers' not in entry
        audio.append(dict(audioId=entry['sourceId'], file=str(file), sha256=entry['sha256'], questionNumbers=entry.get('questionNumbers', list(range(1,101))), part=entry.get('part'), scope='FULL_LISTENING' if full else entry['ownerScope'].upper(), intendedUses=['FULL_TEST_LISTENING'] if full else ['PART_PRACTICE','ANSWER_REVIEW'], mappingBasis='FULL_SOURCE_FILE' if full else 'FILENAME_AND_SOURCE_QUESTION_RANGE', audioContentReviewed=False, fullTrackStartSeconds=None, fullTrackEndSeconds=None, integrationNote='Source mapping only; current Test DTO/player has no test-level audio field' if full else 'One shared clip per Part 3/4 group; do not duplicate uploads per member question'))
    clips = [a for a in audio if a['scope'] != 'FULL_LISTENING']
    coverage = [n for a in clips for n in a['questionNumbers']]
    if sorted(coverage) != list(range(1,101)) or len(clips) != 54:
        raise ValueError('Clip names must cover listening 1..100 exactly once')
    full_tracks = [a for a in audio if a['scope'] == 'FULL_LISTENING']
    if len(full_tracks) != 1:
        raise ValueError('Expected one original full Listening track')
    write_json(out / 'audio-mapping.json', audio)
    write_csv(out / 'audio-mapping.csv', ['audioId','file','questionNumbers','part','scope','intendedUses','mappingBasis','sha256','audioContentReviewed'], audio)

    # Find question number anchors in each known source page, choosing option
    # blocks rather than the same printed number under a Part 6 blank.
    anchors, missing = {}, []
    for q in dataset['questions']:
        n = q['questionNumber']
        if n < 32:
            continue
        source_ref = q['source'][0]
        code = '11' if n <= 100 else '12'
        candidates = []
        for number in source_ref['pdfPages']:
            page = page_index[(code, number)]
            for line in page['lines']:
                for w in line['words']:
                    token = w['text'].strip('.．,:;)-')
                    if token == str(n) and (180 <= w['x'] <= 400 or 850 <= w['x'] <= 1100) and w['y'] < 2200:
                        candidates.append(dict(page=number, x=w['x'], y=w['y'], code=code))
        if candidates:
            anchors[n] = max(candidates, key=lambda a: a['y'])
        else:
            missing.append(n)
    per_page = defaultdict(list)
    for n, anchor in anchors.items():
        per_page[(anchor['code'], anchor['page'])].append((n, anchor))
    # Visually reconciled Part 5 blanks from RC PDF pages 2-4. OCR often drops
    # the printed horizontal blank entirely, so never infer these from grammar.
    part5_stems = {
        101: 'When she held her last meeting, Ms. Toba ------- her sales staff to perform even better next quarter.',
        102: 'All staff have been informed ------- the proposed partnership with ERI Finance.',
        103: 'On Friday, Mr. Nakamura will discuss ------- ideas for supporting busy waiters.',
        104: "The Forestry Commission was created to ------- the state's natural resources and wildlife.",
        105: 'By following established guidelines, construction workers will be able to complete their tasks -------.',
        106: 'With her numerous credentials, Dr. Kwan is highly ------- to teach medieval history at Maston University.',
        107: '------- at the annual technology conference is mandatory for all engineers at the Treemont Corporation.',
        108: 'The café ------- features poets, folk singers, and drama groups on its stage.',
        109: 'Before the seminar began, attendees were assured ------- all scheduled presenters would appear.',
        110: 'Forever Pet has been a leader in bringing new products, ------- Fun Bone and Chew Right, to the market.',
        111: 'Ms. Turner is in charge of ------- the organization of records in the human services department.',
        112: 'Sheefon Bank clients always receive an e-mail or text ------- following any change to their account password.',
        113: 'A drop in consumer demand has led to a ------- decrease in the production of large pickup trucks.',
        114: 'After coating the potatoes in flour and spices, chefs should place them ------- into the deep fryer.',
        115: 'Several banks have released applications that allow ------- customers to pay bills easily by phone.',
        116: 'The personnel department will ------- only those applicants who have five or more years of experience for the position.',
        117: 'Employees of Belfore Electronics Ltd. are ------- involved in community-assistance programs.',
        118: 'The executives at Macalter Equipment decided they would not ------- the contract without major changes.',
        119: 'Wet suits are made with a ------- layer of rubber that traps heat and keeps divers warm.',
        120: 'Newcamp Services managers will meet to discuss the proposed ------- of three smaller branches into one large branch.',
        121: "At Yarzen Technology, clients' records are ------- and can only be accessed by a small group of fund managers.",
        122: 'The featured panel at the NHJ Medical Conference will discuss recent ------- in online health-care services.',
        123: "All of Millville's restaurants ------- several times a year by the city health department.",
        124: 'Sweet Sunlight Bakery has steadily built a ------- base of customers with its delicious cookies and cakes.',
        125: 'According to financial analysts, ------- in medical technology companies are expected to increase in value.',
        126: "The city's harbor is ------- to container ships and fishing vessels of all sizes.",
        127: "Maya's Dancewear expanded its advertising markets, and sales have ------- increased.",
        128: 'Dobson Ice Cream will not introduce any new flavors ------- the customer survey results are analyzed.',
        129: 'The renovated company gym ------- with free weights and exercise machines.',
        130: '------- driving their cars, workers who travel to the town center should use the bus lines.',
    }
    questions, parser_issues, reconciliations = [], [], []
    for q in dataset['questions']:
        n, part = q['questionNumber'], q['payload']['part']
        code = '11' if n <= 100 else '12'
        text, options, stem, box = '', [], None, None
        if n >= 32 and n in anchors:
            a = anchors[n]
            neighbors = per_page[(code, a['page'])]
            right = [b['x'] for _, b in neighbors if b['x'] >= 800]
            split = min(right)-25 if right else 970
            left_column = a['x'] < 800
            next_y = min([b['y'] for m, b in neighbors if m != n and (b['x'] < 800) == left_column and b['y'] > a['y']+30] or [2240])
            box = [180 if left_column else split, a['y']-9, split if left_column else 1825, next_y-12]
            page = page_index[(code, a['page'])]
            words = [w for line in page['lines'] for w in line['words'] if box[0] <= w['x'] < box[2] and box[1] <= w['y'] + w['height']/2 < box[3]]
            lines = word_lines(words)
            # A final question can otherwise capture the page-wide stop message.
            lines = [line for line in lines if not re.search(r'before time is called|check (?:your )?work|Stop!|GO ON TO THE NEXT PAGE|^TEST\s*1', line, re.I)]
            text = '\n'.join(lines)
            text = re.sub(r'^\s*'+str(n)+r'[.．,:;)-]?\s*', '', text)
            matches = list(re.finditer(r'(?mi)^\s*\(([A-D])\)\s*', text))
            if matches:
                stem = text[:matches[0].start()].strip() or None
                for i, match in enumerate(matches):
                    end = matches[i+1].start() if i+1 < len(matches) else len(text)
                    options.append(dict(optionCode=match[1].upper(), optionText=re.sub(r'\s+', ' ', text[match.end():end]).strip()))
            if n == 133:
                options = q['payload']['options']
                reconciliations.append(dict(questionNumber=n, field='printedOptions', evidence='RC PDF page 5; original A/I line omitted by OCR'))
            if n in [171,175]:
                options = [dict(optionCode=c,optionText=f'[{i}]') for i,c in enumerate('ABCD',1)]
                stem = re.sub(r'\[11', '[1]', stem or text).replace('[1]]','[1]')
                reconciliations.append(dict(questionNumber=n, field='printedOptions', evidence=f'RC PDF page {a["page"]}; visually checked four bracketed positions'))
            if n == 173:
                options = [dict(optionCode=c,optionText=value) for c,value in zip('ABCD',['£39','£59','£79','£100'])]
                reconciliations.append(dict(questionNumber=n, field='printedOptions', evidence='RC PDF page 21; pound symbols and digits checked visually'))
            if part == 5:
                stem = part5_stems[n]
                reconciliations.append(dict(questionNumber=n, field='printedQuestionText', evidence=f'RC PDF page {a["page"]}; blank position checked visually'))
            if [o['optionCode'] for o in options] != list('ABCD'):
                parser_issues.append(dict(questionNumber=n, reason='OCR option labels need manual reconciliation', labels=[o['optionCode'] for o in options]))
        elif n >= 32:
            parser_issues.append(dict(questionNumber=n, reason='Question anchor missing'))
        clip = next((a for a in clips if n in a['questionNumbers']), None)
        refs = [a['assetId'] for a in assets if n in a['questionNumbers']]
        row = dict(questionNumber=n, sourceId=q['sourceId'], part=part, source=q['source'][0], printedQuestionText=stem, printedOptions=options, rawQuestionBlock=text or None, sourceRegion=box, rawOcrEditoriallyReviewed=False, correctOption=answer_key[n-1]['correctOption'], groupSourceId=q.get('groupSourceId'), imageAssetIds=refs, audioClipId=clip['audioId'] if clip else None, fullListeningAudioId=full_tracks[0]['audioId'] if n<=100 else None, blankNumber=n if part == 6 else None)
        if n < 32:
            row['printedOptions'] = [dict(optionCode=c, optionText=None) for c in ('ABC' if part == 2 else 'ABCD')]
            row['sourceNote'] = 'Questions and option statements are spoken, not printed in the exam PDF; no transcript has been invented.'
        if q['quality'].get('textReviewed'):
            row['existingEditedPayload'] = q['payload']
            row['existingEditorialQuality'] = q['quality']
        questions.append(row)
    write_json(out / 'questions.json', questions)
    write_json(out / 'text-reconciliations.json', reconciliations)
    write_json(out / 'ocr-review-queue.json', parser_issues)
    audio_by_q = [dict(questionNumber=n, audioClipId=next(a['audioId'] for a in clips if n in a['questionNumbers']), audioFile=next(a['file'] for a in clips if n in a['questionNumbers']), fullAudioId=full_tracks[0]['audioId'], groupShared=n>=32) for n in range(1,101)]
    write_csv(out / 'question-audio.csv', ['questionNumber','audioClipId','audioFile','fullAudioId','groupShared'], audio_by_q)
    write_exam_text(out, questions, dataset)
    groups = []
    for group in dataset['groups']:
        numbers = group['questionNumbers']
        docs = sorted([a for a in assets if a['role']=='PASSAGE_DOCUMENT' and a['questionNumbers']==numbers],key=lambda a:a['documentOrder'])
        if group['payload']['part'] >= 6:
            expected = group.get('documentCount',1)
            if len(docs) != expected:
                raise ValueError('Document count/order mismatch: '+group['sourceId'])
        groups.append(dict(sourceId=group['sourceId'],part=group['payload']['part'],questionNumbers=numbers,documents=[dict(assetId=a['assetId'],order=a['documentOrder'],imageFile=a['imageFile'],rawOcrTextFile=a['ocrTextFile']) for a in docs],existingEditedPassage=group['payload'] if group['quality'].get('textReviewed') else None,editoriallyApproved=group['quality'].get('approved',False)))
    write_json(out / 'groups.json', groups)
    write_json(out / 'source-files.json', [dict(file=f['file'],bytes=f['bytes'],sha256=f['sha256']) for f in inventory['files']])
    for index in range(0,len(assets),12):
        contact=Image.new('RGB',(1200,1200),'#eeeeee');draw=ImageDraw.Draw(contact)
        for offset,asset in enumerate(assets[index:index+12]):
            im=Image.open(out/asset['imageFile']).convert('RGB');im.thumbnail((280,335))
            x=(offset%4)*300+10;y=(offset//4)*400+45
            contact.paste(im,(x,y));draw.text((x,y-30),asset['assetId'],fill='black')
        contact.save(evidence/f'assets-contact-{index//12+1}.jpg',quality=94)
    for p, before in protected.items():
        if digest(p.read_bytes()) != before:
            raise ValueError('Protected live dataset/checkpoint changed: '+str(p))
    validation=dict(questionCount=len(questions),answerCount=len(exported_keys),answerImageTranscriptionChecked=True,sourcePdfPages=sum(p['pages'] for p in pdf_info),nativePdfTextCharacters=sum(p['nativeTextCharacters'] for p in pdf_info),ocrReused=True,ocrRerun=False,embeddedImageOccurrences=len(streams),uniqueEmbeddedImageFiles=len(unique_streams),semanticCrops=len(assets),assessedPhotos=6,listeningGraphics=5,examplePhotos=1,passageDocuments=27,groups=len(groups),audioClipFiles=len(clips),fullAudioFiles=len(full_tracks),audioCoverage=list(range(1,101)),audioContentReviewed=False,ocrParserIssues=parser_issues,liveDatasetAndCheckpointUnchanged=True,databaseTouched=False,editorialAcceptance=False,layoutReviewPending=True)
    write_json(out / 'validation.json', validation)
    (out/'README.md').write_text('''# TEST 1 - source extraction package

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
''',encoding='utf-8')
    print(json.dumps(dict(out=str(out),questions=len(questions),assets=len(assets),clips=len(clips),parserIssues=parser_issues),ensure_ascii=True))


if __name__ == '__main__':
    main()
