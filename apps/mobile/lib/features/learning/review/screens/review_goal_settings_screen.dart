import 'package:flutter/material.dart';
import 'package:toeic_mobile/features/learning/review/screens/today_review_screen.dart';

import '../widgets/quantity_stepper.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../theme/app_colors.dart';

class ReviewGoalSettingsScreen extends StatefulWidget {
  const ReviewGoalSettingsScreen({super.key});

  @override
  State<ReviewGoalSettingsScreen> createState() =>
      _ReviewGoalSettingsScreenState();
}

class _ReviewGoalSettingsScreenState extends State<ReviewGoalSettingsScreen> {
  int _dailyGoal = 20;
  bool _remindEnabled = true;
  static const int _minGoal = 5;
  static const int _maxGoal = 100;
  static const int _step = 5;

  void _decrease() => setState(
    () => _dailyGoal = (_dailyGoal - _step).clamp(_minGoal, _maxGoal),
  );
  void _increase() => setState(
    () => _dailyGoal = (_dailyGoal + _step).clamp(_minGoal, _maxGoal),
  );

  void _onSave() {
    Navigator.of(context).pop(_dailyGoal);
  }
  void _onCancel(BuildContext context) => Navigator.of(context).maybePop();

  @override
  Widget build(BuildContext context) {
    final reviewCount = (_dailyGoal * 0.75).round();
    final newCount = _dailyGoal - reviewCount;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Mục tiêu ôn từ',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.slate900,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Mỗi ngày',
                style: TextStyle(fontSize: 13, color: AppColors.slate500),
              ),
              const SizedBox(height: 20),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Số từ muốn học mới',
                      style: TextStyle(fontSize: 14, color: AppColors.slate500),
                    ),
                    const SizedBox(height: 12),
                    QuantityStepper(
                      value: _dailyGoal,
                      onDecrease: _decrease,
                      onIncrease: _increase,
                      suffix: 'từ/ngày',
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Nhập từ 5 đến 100 từ. Bấm +/- để tăng giảm 5.',
                      style: TextStyle(fontSize: 12, color: AppColors.slate400),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.slate50,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '$reviewCount từ ôn lại + $newCount từ mới mỗi ngày',
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.slate700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              AppCard(
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Nhắc ôn từ vựng lúc 20:00',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.slate900,
                        ),
                      ),
                    ),
                    Switch(
                      value: _remindEnabled,
                      activeColor: AppColors.brand,
                      onChanged: (v) => setState(() => _remindEnabled = v),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: _onSave,
                child: const Text('Lưu cài đặt'),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: () => _onCancel(context),
                child: const Text('Hủy'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
