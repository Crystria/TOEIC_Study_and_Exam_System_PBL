import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/navigation/full_screen_flow_scope.dart';
import '../../../../theme/app_colors.dart';
import '../../models/test_attempt.dart';
import '../../providers/mock_test_taking_provider.dart';
import '../../repositories/mock_test_attempt_repository.dart';
import '../../providers/select_test_parts_provider.dart';
import '../test_taking/mock_test_taking_screen.dart';

class SelectTestPartsScreen extends StatefulWidget {
  const SelectTestPartsScreen({
    super.key,
    required this.testId,
    required this.attemptRepository,
    this.initialMode = TestAttemptMode.full,
  });

  final String testId;
  final TestAttemptMode initialMode;
  final MockTestAttemptRepository attemptRepository;

  @override
  State<SelectTestPartsScreen> createState() => _SelectTestPartsScreenState();
}

class _SelectTestPartsScreenState extends State<SelectTestPartsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<SelectTestPartsProvider>().loadStructure(
        widget.testId,
        initialMode: widget.initialMode,
      );
    });
  }

  Future<void> _startAttempt(BuildContext context) async {
    final provider = context.read<SelectTestPartsProvider>();
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final attempt = await provider.startAttempt(widget.testId);

    if (!mounted) return;
    if (attempt == null) {
      final message = provider.errorMessage ?? 'Không thể bắt đầu bài thi.';
      messenger.showSnackBar(SnackBar(content: Text(message)));
      return;
    }

    navigator.push(
      MaterialPageRoute<void>(
        builder: (_) => ChangeNotifierProvider<MockTestTakingProvider>(
          create: (_) =>
              MockTestTakingProvider(repository: widget.attemptRepository)
                ..loadAttempt(attempt.attemptId),
          child: MockTestTakingScreen(attemptId: attempt.attemptId),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FullScreenFlowScope(
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          child: Consumer<SelectTestPartsProvider>(
            builder: (context, provider, _) {
              if (provider.status == SelectPartsStatus.loading ||
                  provider.status == SelectPartsStatus.idle) {
                return const Center(child: CircularProgressIndicator());
              }

              if (provider.status == SelectPartsStatus.error) {
                return _LoadError(
                  message:
                      provider.errorMessage ?? 'Không thể tải cấu trúc đề thi.',
                  onRetry: () => provider.loadStructure(
                    widget.testId,
                    initialMode: widget.initialMode,
                  ),
                );
              }

              final test = provider.test;
              if (test == null) {
                return const Center(child: Text('Không tìm thấy đề thi.'));
              }

              return ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    'Chọn hình thức thi',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    test.title,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.slate500,
                    ),
                  ),
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: () => Navigator.of(context).maybePop(),
                    child: const Text(
                      '← Danh sách đề',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.brand,
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: _ModeCard(
                          title: 'Thi đầy đủ',
                          subtitle: 'FULL',
                          selected: provider.mode == TestAttemptMode.full,
                          onTap: () => provider.setMode(TestAttemptMode.full),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _ModeCard(
                          title: 'Luyện theo Part',
                          subtitle: 'PART',
                          selected: provider.mode == TestAttemptMode.part,
                          onTap: () => provider.setMode(TestAttemptMode.part),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (provider.mode == TestAttemptMode.full) ...[
                    _FullModeSummary(
                      totalQuestions: test.totalQuestions,
                      partCount: provider.parts.length,
                    ),
                    if (!provider.canStart) ...[
                      const SizedBox(height: 8),
                      const Text(
                        'Đề thi chưa có đủ 7 Part khả dụng và 200 câu để bắt đầu FULL.',
                        style: TextStyle(fontSize: 12, color: AppColors.danger),
                      ),
                    ],
                  ] else
                    _PartModeSelection(provider: provider),
                  if (provider.errorMessage != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      provider.errorMessage!,
                      style: const TextStyle(
                        color: AppColors.danger,
                        fontSize: 12,
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed:
                          provider.canStart &&
                              provider.status != SelectPartsStatus.starting
                          ? () => _startAttempt(context)
                          : null,
                      child: provider.status == SelectPartsStatus.starting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Bắt đầu làm bài'),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  const _ModeCard({
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          color: selected ? AppColors.blueChipBg : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? AppColors.brand : AppColors.border,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: selected ? AppColors.brand : AppColors.slate400,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.slate900,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FullModeSummary extends StatelessWidget {
  const _FullModeSummary({
    required this.totalQuestions,
    required this.partCount,
  });

  final int totalQuestions;
  final int partCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.blueChipBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.brand),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Bài thi TOEIC đầy đủ',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.slate900,
            ),
          ),
          const SizedBox(height: 10),
          _SummaryLine(
            label: 'Phạm vi',
            value: '$partCount Parts · $totalQuestions câu',
          ),
          const SizedBox(height: 6),
          const _SummaryLine(label: 'Thời gian', value: '120 phút'),
          const SizedBox(height: 6),
          const _SummaryLine(label: 'Chế độ', value: 'FULL'),
        ],
      ),
    );
  }
}

class _PartModeSelection extends StatelessWidget {
  const _PartModeSelection({required this.provider});

  final SelectTestPartsProvider provider;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Chọn Part muốn luyện',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: AppColors.slate900,
              ),
            ),
            TextButton(
              onPressed: provider.availableParts.isEmpty
                  ? null
                  : provider.toggleAllParts,
              child: Text(
                provider.allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả',
              ),
            ),
          ],
        ),
        ...provider.parts.map((part) {
          final selected = provider.selectedParts.contains(part.part);
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: part.available
                  ? () => provider.togglePart(part.part)
                  : null,
              child: Container(
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: !part.available
                      ? AppColors.slate50
                      : selected
                      ? AppColors.blueChipBg
                      : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: selected ? AppColors.brand : AppColors.border,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      !part.available
                          ? Icons.lock_outline
                          : selected
                          ? Icons.check_circle
                          : Icons.radio_button_unchecked,
                      color: !part.available
                          ? AppColors.slate400
                          : selected
                          ? AppColors.brand
                          : AppColors.slate400,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Part ${part.part} · ${part.title}',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.slate900,
                            ),
                          ),
                          if (!part.available && part.errors.isNotEmpty)
                            Text(
                              part.errors.join(' '),
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.slate500,
                              ),
                            ),
                        ],
                      ),
                    ),
                    Text(
                      part.available
                          ? '${part.totalQuestions} câu'
                          : 'Chưa khả dụng',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
        const SizedBox(height: 12),
        const Text(
          'Thời lượng luyện tập',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: AppColors.slate900,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: SelectTestPartsProvider.durationLabels.entries.map((entry) {
            final selected = provider.selectedDurationSeconds == entry.key;
            return ChoiceChip(
              label: Text(entry.value),
              selected: selected,
              onSelected: (_) => provider.selectDuration(entry.key),
            );
          }).toList(),
        ),
        const SizedBox(height: 10),
        Text(
          '${provider.selectedParts.length} Part · ${provider.totalQuestions} câu · '
          '${SelectTestPartsProvider.durationLabels[provider.selectedDurationSeconds]}',
          style: const TextStyle(fontSize: 12, color: AppColors.slate500),
        ),
        const SizedBox(height: 4),
        const Text(
          'Thời lượng PART phải từ 5 phút đến 3 giờ. Chế độ PART vẫn giữ nguyên '
          'kể cả khi bạn chọn đủ 7 Part.',
          style: TextStyle(fontSize: 11, color: AppColors.slate500),
        ),
      ],
    );
  }
}

class _SummaryLine extends StatelessWidget {
  const _SummaryLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: AppColors.slate500)),
        Text(
          value,
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            color: AppColors.slate900,
          ),
        ),
      ],
    );
  }
}

class _LoadError extends StatelessWidget {
  const _LoadError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: const Text('Thử lại')),
          ],
        ),
      ),
    );
  }
}
