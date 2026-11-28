import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { LESSON_CONTENT_SECTIONS, type LessonBody } from '@/lib/lessons/detail-types';

export function LessonDetailContent({ body, href }: { body: LessonBody; href: string }) {
  return (
    <div className="ld-layout">
      <nav className="ld-outline" aria-label="Mục lục nội dung minh họa">
        <p>NỘI DUNG BÀI HỌC</p>
        <ol>
          {LESSON_CONTENT_SECTIONS.map((section, index) => (
            <li key={section.id}>
              <Link
                href={`${href}#${section.id}`}
                onClick={() => document.getElementById(section.id)?.focus()}
              >
                <span aria-hidden="true">0{index + 1}</span>
                {section.label}
              </Link>
            </li>
          ))}
        </ol>
        <small>Chỉ xem nội dung quản trị, không ghi tiến độ học tập.</small>
      </nav>
      <article className="ld-content" aria-label="Nội dung bài học minh họa">
        <Card className="ld-card">
          <h2 id="ld-theory" tabIndex={-1}>
            <span aria-hidden="true">01</span>Lý thuyết
          </h2>
          {body.theory?.length ? (
            body.theory.map((text, index) => (
              <p key={index} className="ld-text">
                {text}
              </p>
            ))
          ) : (
            <p className="ld-missing">Chưa có dữ liệu lý thuyết.</p>
          )}
        </Card>
        <Card className="ld-card">
          <h2 id="ld-structures" tabIndex={-1}>
            <span aria-hidden="true">02</span>Cấu trúc
          </h2>
          {body.structures?.length ? (
            <dl className="ld-structures">
              {body.structures.map((structure, index) => (
                <div key={index}>
                  <dt>{structure.label}</dt>
                  <dd className="ld-text" lang="en">
                    {structure.pattern}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="ld-missing">Chưa có dữ liệu cấu trúc.</p>
          )}
        </Card>
        <Card className="ld-card">
          <h2 id="ld-examples" tabIndex={-1}>
            <span aria-hidden="true">03</span>Ví dụ trong công việc
          </h2>
          {body.examples?.length ? (
            <ol className="ld-examples">
              {body.examples.map((example, index) => (
                <li key={index}>
                  <h3>Ví dụ {index + 1}</h3>
                  <p lang="en" className="ld-text ld-sentence">
                    {example.sentence}
                  </p>
                  <p className="ld-text ld-meaning">{example.meaning}</p>
                  <p className="ld-text ld-example-note">{example.explanation}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="ld-missing">Chưa có dữ liệu ví dụ.</p>
          )}
        </Card>
        <Card className="ld-card ld-notes">
          <h2 id="ld-notes" tabIndex={-1}>
            <span aria-hidden="true">04</span>Lưu ý sử dụng
          </h2>
          {body.notes?.length ? (
            <ul>
              {body.notes.map((note, index) => (
                <li className="ld-text" key={index}>
                  {note}
                </li>
              ))}
            </ul>
          ) : (
            <p className="ld-missing">Chưa có dữ liệu lưu ý.</p>
          )}
        </Card>
      </article>
    </div>
  );
}
