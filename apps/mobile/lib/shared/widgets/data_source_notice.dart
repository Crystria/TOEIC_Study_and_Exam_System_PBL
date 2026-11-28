import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

/// Explains when a domain response is explicitly marked as illustrative.
/// The widget does not inspect or select the configured data source.
class DataSourceNotice extends StatelessWidget {
  const DataSourceNotice({
    super.key,
    required this.isIllustrative,
    required this.featureName,
  });

  final bool isIllustrative;
  final String featureName;

  @override
  Widget build(BuildContext context) {
    if (!isIllustrative) return const SizedBox.shrink();

    final normalizedFeatureName = featureName.trim();
    final subject = normalizedFeatureName.isEmpty
        ? 'nội dung này'
        : normalizedFeatureName;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.warningBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline, color: AppColors.warning, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Đang hiển thị dữ liệu minh họa cho $subject. '
              'Dữ liệu này không được tải từ Backend.',
              style: const TextStyle(
                color: AppColors.slate700,
                fontSize: 12,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
