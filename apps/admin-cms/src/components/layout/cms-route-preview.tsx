import { CMS_DESTINATIONS, type CmsPath } from '@/lib/demo/cms-fixtures';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function CmsRoutePreview({ path }: { path: CmsPath }) {
  const destination = CMS_DESTINATIONS.find((item) => item.href === path)!;
  return (
    <section className="cms-route-intro">
      <span className="cms-eyebrow">{destination.group}</span>
      <h1>{destination.label}</h1>
      <p>{destination.description}</p>
      <Card className="cms-placeholder">
        <CardHeader>
          <CardTitle>Không gian đang được chuẩn bị</CardTitle>
        </CardHeader>
        <CardContent>
          <span className="cms-placeholder-symbol" aria-hidden="true">
            ▤
          </span>
          <h2>Điều hướng đã sẵn sàng để xem thử</h2>
          <p>
            Phiên này chỉ minh họa bố cục và menu theo vai trò. Chưa hiển thị danh sách hoặc dữ liệu
            quản trị.
          </p>
          <p>Chức năng quản lý sẽ được triển khai ở các phiên tiếp theo.</p>
        </CardContent>
      </Card>
    </section>
  );
}
