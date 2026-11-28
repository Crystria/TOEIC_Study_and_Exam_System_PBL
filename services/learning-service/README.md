# Learning Service

Vocabulary, grammar lessons, learner progress and spaced repetition. Shared catalog changes remain restricted to `CONTENT_ADMIN` under `/api/v1/learning/admin`.

## Personal vocabulary and grammar

Every authenticated learner can manage their own content through these collections:

| Collection                                    | Fields for creation                                                      | Response ID    |
| --------------------------------------------- | ------------------------------------------------------------------------ | -------------- |
| `/api/v1/learning/personal/vocabulary-topics` | `topicName`                                                              | `topicId`      |
| `/api/v1/learning/personal/vocabularies`      | `topicId`, `word`, `definition`; optional nullable `phonetic`, `example` | `vocabularyId` |
| `/api/v1/learning/personal/lessons`           | `lessonTitle`, `category`, `contentMarkdown`                             | `lessonId`     |

Each collection supports `GET` and `POST`; `/:id` supports `GET`, `PATCH` and `DELETE`. `PATCH` accepts a nonempty subset of the creation fields. Names, titles, words, categories and phonetics allow up to 255 characters; definitions/examples allow 10,000 and Markdown allows 100,000. Required text must contain non-whitespace characters. Set `phonetic` or `example` to `null` to clear it.

Lists accept `page` (default 1), `size` (default 20, maximum 50) and `keyword`. Vocabulary also accepts `topicId`; lessons accept `category`. Responses contain `items`, `total`, `page`, `size` and `totalPages`. Topic responses include `vocabularyCount`. Personal vocabulary has `audioUrl: null` and `imageUrl: null`; personal lessons always have `status: "PRIVATE"`.

Ownership comes exclusively from the authenticated JWT subject. Owner IDs, publication status and unknown fields are rejected in requests. Reads, updates, deletes and topic references belonging to another account return the same `404 PERSONAL_CONTENT_NOT_FOUND` as missing content. Separate tables and a composite topic/owner foreign key keep private content outside the shared catalog and its learning sessions/progress.

Send an `Idempotency-Key` header, preferably a UUID, on every `POST`. Repeating the same owner's key and payload for the same collection returns the original result; reusing it with a changed payload returns `409`. Deletes return `{ "id": "...", "deleted": true, "success": true }`. Deleting a personal topic atomically deletes its personal vocabulary through the database foreign key; the client must make that cascade clear before deletion.

## Migration and verification

The additive migration `20261113090000_personal_learning_content` creates only the three personal-content tables, indexes and their ownership-preserving foreign key. Deploy it against the intended Learning database, generate its client and restart the service:

```powershell
npm.cmd run prisma:deploy -w @toeic/learning-service
npm.cmd run prisma:generate -w @toeic/learning-service
npm.cmd run build -w @toeic/learning-service
```

Run focused validation/ownership tests with:

```powershell
npm.cmd run test -w @toeic/learning-service -- --runInBand personal-content.spec.ts
```

`npm.cmd run test:p3 -w @toeic/learning-service` additionally exercises authenticated personal CRUD, two-account isolation, closed request schemas, idempotency, cascade deletion and the database ownership constraint through the Gateway. Its runner creates and drops isolated local `p3_*` databases and test-specific broker queues; it does not migrate the existing Learning database. Set `REDIS_URL` to the local verification Redis endpoint when its port differs from the runner's default.
