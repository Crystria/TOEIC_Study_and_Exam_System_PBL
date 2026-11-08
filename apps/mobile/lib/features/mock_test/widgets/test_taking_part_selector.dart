import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../providers/mock_test_taking_provider.dart';

class TestTakingPartSelector extends StatelessWidget {
  const TestTakingPartSelector({super.key, required this.provider});

  final MockTestTakingProvider provider;

  static const Map<int, String> _partNames = {
    1: 'Ảnh',
    2: 'Hỏi-đáp',
    3: 'Hội thoại',
    4: 'Bài nói',
    5: 'Câu đơn',
    6: 'Đoạn văn',
    7: 'Đọc hiểu',
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: provider.availableParts.map((part) {
            final active = provider.currentQuestion?.part == part;
            final total = provider.questionCountForPart(part);
            final answered = provider.answeredCountForPart(part);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => provider.jumpToPart(part),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 11,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: active ? AppColors.blueChipBg : AppColors.slate50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: active ? AppColors.brand : AppColors.border,
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Part $part',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: active ? AppColors.brand : AppColors.slate700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${_partNames[part]} · $answered/$total',
                        style: TextStyle(
                          fontSize: 9,
                          color: active ? AppColors.brand : AppColors.slate500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}
