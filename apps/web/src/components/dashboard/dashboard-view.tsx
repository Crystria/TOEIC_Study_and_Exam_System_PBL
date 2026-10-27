'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { dashboardRepository } from '@/lib/dashboard/repository';
import { selectPrediction, selectScoreHistory } from '@/lib/dashboard/selectors';
import type { PreviewScenario, StudentDashboard, TimeRange } from '@/lib/dashboard/types';

import { buttonStyles } from '../ui/button';
import { Badge, DashboardSkeleton, EmptyState, ErrorState, Progress } from '../ui/feedback';
import { Icon, type IconName } from '../ui/icon';
import { Panel, SectionHeading } from '../ui/panel';
import { ScoreTrend } from './score-trend';

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: StudentDashboard };

export function DashboardView({ scenario }: { scenario: PreviewScenario }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [range, setRange] = useState<TimeRange>('LAST_30_DAYS');
  const [retry, setRetry] = useState(0);
  const retryFocusPending = useRef(false);

  useEffect(() => {
    if (state.status === 'loading' || !retryFocusPending.current) return;
    retryFocusPending.current = false;
    // The retry button unmounts while loading; resume navigation in the loaded content.
    if (document.activeElement === document.body) {
      document.getElementById('main-content')?.focus();
    }
  }, [state.status]);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    dashboardRepository
      .load(scenario === 'error' && retry > 0 ? 'ready' : scenario, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [scenario, retry]);

  if (state.status === 'loading') return <DashboardSkeleton />;
  if (state.status === 'error')
    return (
      <ErrorState
        onRetry={() => {
          retryFocusPending.current = true;
          setRetry((value) => value + 1);
        }}
      />
    );

  const { data } = state;
  const prediction = selectPrediction(data);
  const scoreHistory = selectScoreHistory(data, range);
  const eligibleCount = selectScoreHistory(data, 'LAST_30_DAYS').length;
  const stats: Array<{
    label: string;
    value: number;
    unit: string;
    icon: IconName;
    color: string;
    detail: string;
  }> = [
    {
      label: 'Chuỗi ngày học',
      value: data.statistics.learningStreakDays,
      unit: 'ngày',
      icon: 'flame',
      color: 'orange',
      detail: 'Giữ nhịp học tập mỗi ngày',
    },
    {
      label: 'Từ vựng đã học',
      value: data.statistics.vocabulariesLearned,
      unit: 'từ',
      icon: 'layers',
      color: 'blue',
      detail: 'Tích lũy từ các phiên học',
    },
    {
      label: 'Ngữ pháp hoàn thành',
      value: data.statistics.grammarLessonsCompleted,
      unit: 'bài',
      icon: 'book',
      color: 'purple',
      detail: 'Xây dựng nền tảng vững chắc',
    },
    {
      label: 'Bài thi thử hợp lệ',
      value: data.statistics.mockTestCount,
      unit: 'bài',
      icon: 'clipboard',
      color: 'green',
      detail: 'Toàn bộ đề, đủ hai kỹ năng',
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CÙNG BẠN TIẾN BỘ MỖI NGÀY</div>
          <h1>
            Chào {data.profile.fullName}
            <span className="greeting-dot">,</span>
          </h1>
          <p>Một chút nỗ lực hôm nay, một bước gần hơn đến mục tiêu.</p>
        </div>
        <Link href="/study/vocabulary" className={buttonStyles('primary')}>
          <Icon name="book" width="18" />
          Tiếp tục học
          <Icon name="arrow" width="17" />
        </Link>
      </div>
      <div className="demo-notice">
        <Icon name="info" width="16" />
        <span>Không gian mẫu của Minh Anh · Số liệu minh họa, chưa liên kết tài khoản.</span>
        <Link href="/login">
          Đăng nhập
          <Icon name="arrow" width="14" />
        </Link>
      </div>
      <div className="dashboard-top-grid">
        <section className="goal-hero" aria-labelledby="goal-title">
          <div className="hero-content">
            <span className="hero-label">
              <Icon name="target" width="17" /> MỤC TIÊU CỦA BẠN
            </span>
            <h2 id="goal-title">
              {data.settings.targetToeicScore ? (
                <>
                  Hướng đến <strong>{data.settings.targetToeicScore}+ TOEIC</strong>
                </>
              ) : (
                <>
                  Hành trình TOEIC
                  <br />
                  <strong>bắt đầu từ hôm nay</strong>
                </>
              )}
            </h2>
            <p>
              {prediction !== null
                ? 'Duy trì luyện tập và tập trung vào những Part cần cải thiện.'
                : 'Hoàn thành 3 bài thi thử hợp lệ trong 30 ngày để xem điểm dự đoán.'}
            </p>
            <Link href="/practice" className={buttonStyles('light')}>
              Luyện tập ngay
              <Icon name="arrow" width="17" />
            </Link>
          </div>
          <div className="prediction-display">
            <div className="prediction-ring">
              <span className="prediction-caption">ĐIỂM DỰ ĐOÁN</span>
              <strong>{prediction ?? '—'}</strong>
              <span>{prediction === null ? `${eligibleCount}/3 bài hợp lệ` : '/ 990 điểm'}</span>
            </div>
            <span className="prediction-footnote">
              {prediction === null ? 'Chưa đủ dữ liệu' : 'Từ 3 bài thi gần nhất'}
            </span>
          </div>
        </section>
        <Panel className="daily-goals">
          <SectionHeading
            title="Mục tiêu hôm nay"
            action={
              <span className="daily-goal-symbol">
                <Icon name="calendar" width="19" />
              </span>
            }
          />
          <div className="daily-goal-item">
            <div>
              <span>Từ vựng mới</span>
              <strong>
                {data.today.vocabularies}
                <small> / {data.settings.dailyVocabularyGoal} từ</small>
              </strong>
            </div>
            <Progress
              value={data.today.vocabularies}
              max={data.settings.dailyVocabularyGoal}
              label="Mục tiêu từ vựng hôm nay"
            />
          </div>
          <div className="daily-goal-item">
            <div>
              <span>Thời gian học</span>
              <strong>
                {data.today.studyMinutes}
                <small> / {data.settings.dailyStudyMinutes} phút</small>
              </strong>
            </div>
            <Progress
              value={data.today.studyMinutes}
              max={data.settings.dailyStudyMinutes}
              tone="green"
              label="Mục tiêu thời gian học hôm nay"
            />
          </div>
          <p className="daily-goal-note">
            <Icon name="sparkles" width="15" />
            Mỗi bước nhỏ đều được ghi nhận.
          </p>
        </Panel>
      </div>
      <div className="stats-grid">
        {stats.map((stat) => (
          <Panel className="stat-card" key={stat.label}>
            <div className="stat-top">
              <span>{stat.label}</span>
              <span className={`stat-icon stat-icon--${stat.color}`}>
                <Icon name={stat.icon} />
              </span>
            </div>
            <div className="stat-value">
              {stat.value.toLocaleString('vi-VN')}
              <span>{stat.unit}</span>
            </div>
            <p>{stat.detail}</p>
          </Panel>
        ))}
      </div>
      <div className="dashboard-content-grid">
        <Panel className="trend-panel">
          <SectionHeading
            title="Tiến bộ qua từng bài thi"
            description="Điểm thi thử toàn bộ đề · Listening & Reading"
            action={
              <>
                <label className="sr-only" htmlFor="trend-range">
                  Khoảng thời gian thống kê
                </label>
                <select
                  id="trend-range"
                  className="range-select"
                  value={range}
                  onChange={(event) => setRange(event.target.value as TimeRange)}
                >
                  <option value="LAST_7_DAYS">7 ngày gần nhất</option>
                  <option value="LAST_30_DAYS">30 ngày gần nhất</option>
                  <option value="ALL_TIME">Tất cả thời gian</option>
                </select>
              </>
            }
          />
          {scoreHistory.length ? (
            <>
              <div className="chart-legend">
                <span />
                <span>Điểm tổng TOEIC</span>
                <small>Thang điểm 10–990</small>
              </div>
              <ScoreTrend attempts={scoreHistory} target={data.settings.targetToeicScore} />
            </>
          ) : (
            <EmptyState
              title="Chưa có điểm trong khoảng này"
              description="Hoàn thành bài thi thử toàn bộ đề, đủ hai kỹ năng để theo dõi tiến bộ."
              icon="chart"
            >
              <Link href="/exam" className={buttonStyles('secondary')}>
                Khám phá đề thi
                <Icon name="arrow" width="16" />
              </Link>
            </EmptyState>
          )}
          <div className="panel-bottom-link">
            <span>
              <Icon name="info" width="14" /> Luyện tập theo Part không quy đổi điểm TOEIC.
            </span>
            <Link href="/analytics">
              Xem thống kê
              <Icon name="arrow" width="14" />
            </Link>
          </div>
        </Panel>
        <Panel className="focus-panel">
          <SectionHeading title="Tập trung cải thiện" description="Dựa trên tỷ lệ đúng theo Part" />
          {data.weakAreas.length ? (
            <div className="weak-area-list">
              {data.weakAreas.map((area) => (
                <Link key={area.partId} href={area.href} className="weak-area">
                  <div className="weak-area-top">
                    <Badge tone="neutral">Part {area.partId}</Badge>
                    <span>
                      {area.accuracy}% đúng
                      <Icon name="chevron" width="14" />
                    </span>
                  </div>
                  <h3>{area.title}</h3>
                  <Progress
                    value={area.accuracy}
                    max={100}
                    label={`Tỷ lệ đúng Part ${area.partId}`}
                    tone={area.accuracy < 65 ? 'orange' : 'blue'}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Khám phá thế mạnh của bạn"
              description="Làm bài để biết Part nào cần dành thêm thời gian."
              icon="target"
            />
          )}
          <Link href="/practice" className="focus-footer">
            Luyện tập theo Part
            <Icon name="arrow" width="16" />
          </Link>
        </Panel>
      </div>
      <Panel className="recent-panel">
        <SectionHeading
          title="Hoạt động gần đây"
          description="Nhìn lại những bước tiến của bạn"
          action={
            <Link className="text-link" href="/history">
              Lịch sử làm bài
              <Icon name="arrow" width="15" />
            </Link>
          }
        />
        {data.activities.length ? (
          <div className="activity-list">
            {data.activities.map((activity) => (
              <Link key={activity.id} href={activity.href} className="activity-row">
                <span className={`activity-icon activity-icon--${activity.type}`}>
                  <Icon
                    name={
                      activity.type === 'vocabulary'
                        ? 'layers'
                        : activity.type === 'lesson'
                          ? 'book'
                          : 'clipboard'
                    }
                  />
                </span>
                <div className="activity-copy">
                  <strong>{activity.title}</strong>
                  <span>{activity.detail}</span>
                </div>
                <time dateTime={activity.occurredAt}>
                  {new Date(activity.occurredAt).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    timeZone: data.settings.timezone,
                  })}
                </time>
                <Icon name="chevron" width="17" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Sẵn sàng cho hoạt động đầu tiên?"
            description="Học một nhóm từ vựng hoặc đọc một bài ngữ pháp để bắt đầu."
            icon="book"
          >
            <Link href="/study/vocabulary" className={buttonStyles('primary')}>
              Học từ vựng
              <Icon name="arrow" width="16" />
            </Link>
          </EmptyState>
        )}
      </Panel>
    </div>
  );
}
