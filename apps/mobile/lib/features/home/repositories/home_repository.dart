import '../models/dashboard_data.dart';

/// Dashboard-facing contract. The UI provider depends only on this interface;
/// the composition layer supplies an implementation that aggregates feature data.
abstract interface class HomeRepository {
  Future<DashboardData> loadDashboard();
}
