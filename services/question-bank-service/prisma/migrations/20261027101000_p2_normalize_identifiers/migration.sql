-- Prisma keeps its ergonomic id/name properties; DB names follow the agreed CSDL.
ALTER TABLE questions RENAME COLUMN id TO question_id;
ALTER TABLE tags RENAME COLUMN id TO tag_id;
ALTER TABLE tags RENAME COLUMN name TO tag_name;
ALTER INDEX tags_name_key RENAME TO tags_tag_name_key;
