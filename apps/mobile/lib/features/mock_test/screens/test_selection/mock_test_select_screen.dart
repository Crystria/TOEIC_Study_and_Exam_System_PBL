import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../theme/app_colors.dart';
import '../../models/mock_test.dart';
import '../../models/test_attempt.dart';
import '../../mock_test_dependencies.dart';
import '../../providers/mock_test_select_provider.dart';
import '../../providers/select_test_parts_provider.dart';
import '../../repositories/mock_test_attempt_repository.dart';
import '../../repositories/mock_test_repository.dart';
import '../../widgets/filter_tab.dart';
import '../test_history/test_history_screen.dart';
import 'select_test_parts_screen.dart';

class MockTestSelectScreen extends StatelessWidget {
  const MockTestSelectScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<MockTestRepository>.value(
          value: MockTestDependencies.testRepository,
        ),
        Provider<MockTestAttemptRepository>.value(
          value: MockTestDependencies.attemptRepository,
        ),
        ChangeNotifierProvider<MockTestSelectProvider>(
          create: (context) => MockTestSelectProvider(
            repository: context.read<MockTestRepository>(),
          )..loadTests(),
        ),
        ChangeNotifierProvider<SelectTestPartsProvider>(
          create: (context) => SelectTestPartsProvider(
            testRepository: context.read<MockTestRepository>(),
            attemptRepository: context.read<MockTestAttemptRepository>(),
          ),
        ),
      ],
      child: const _MockTestSelectView(),
    );
  }
}

class _MockTestSelectView extends StatelessWidget {
  const _MockTestSelectView();

  void _openHistory(BuildContext context) {
    final attemptRepository = context.read<MockTestAttemptRepository>();
    final testRepository = context.read<MockTestRepository>();

    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TestHistoryScreen(
          attemptRepository: attemptRepository,
          testRepository: testRepository,
        ),
      ),
    );
  }

  void _openSelection(
    BuildContext context,
    MockTest test,
    TestAttemptMode mode,
  ) {
    final partsProvider = context.read<SelectTestPartsProvider>();
    final attemptRepository = context.read<MockTestAttemptRepository>();
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ChangeNotifierProvider<SelectTestPartsProvider>.value(
          value: partsProvider,
          child: SelectTestPartsScreen(
            testId: test.testId,
            initialMode: mode,
            attemptRepository: attemptRepository,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MockTestSelectProvider>();

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: provider.loadTests,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.only(bottom: 24),
            children: [
              Container(
                width: double.infinity,
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.brand,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Thi thử TOEIC',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Chọn đề để thi đầy đủ hoặc luyện tập theo từng Part.',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () => _openHistory(context),
                    icon: const Icon(Icons.history_rounded, size: 18),
                    label: const Text('Lịch sử làm bài'),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Expanded(
                      child: FilterTab(
                        label: 'Tất cả',
                        active: provider.filter == TestFilter.all,
                        onTap: () => provider.changeFilter(TestFilter.all),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilterTab(
                        label: 'Đề đầy đủ',
                        active: provider.filter == TestFilter.fullTest,
                        onTap: () => provider.changeFilter(TestFilter.fullTest),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilterTab(
                        label: 'Luyện theo Part',
                        active: provider.filter == TestFilter.byPart,
                        onTap: () => provider.changeFilter(TestFilter.byPart),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Danh sách đề thi',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppColors.slate900,
                      ),
                    ),
                    Text(
                      '${provider.tests.length} đề',
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              if (provider.status == TestSelectStatus.loading &&
                  provider.tests.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(36),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (provider.status == TestSelectStatus.error &&
                  provider.tests.isEmpty)
                _LoadError(
                  message: provider.errorMessage ?? 'Không thể tải đề thi.',
                  onRetry: provider.loadTests,
                )
              else if (provider.tests.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: Text('Chưa có đề thi khả dụng.')),
                )
              else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    children: provider.tests
                        .map(
                          (test) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _TestCard(
                              test: test,
                              filter: provider.filter,
                              onStartFull: () => _openSelection(
                                context,
                                test,
                                TestAttemptMode.full,
                              ),
                              onStartPart: () => _openSelection(
                                context,
                                test,
                                TestAttemptMode.part,
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ),
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: Text(
                  'Danh sách hiện sử dụng dữ liệu mẫu; chưa kết nối Backend.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: AppColors.slate400),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TestCard extends StatelessWidget {
  const _TestCard({
    required this.test,
    required this.filter,
    required this.onStartFull,
    required this.onStartPart,
  });

  final MockTest test;
  final TestFilter filter;
  final VoidCallback onStartFull;
  final VoidCallback onStartPart;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              test.title,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: AppColors.slate900,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '${test.totalQuestions} câu · ${test.durationLabel} · Listening & Reading',
              style: const TextStyle(fontSize: 12, color: AppColors.slate500),
            ),
            const SizedBox(height: 14),
            if (filter == TestFilter.all)
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onStartFull,
                      child: const Text('Thi đầy đủ'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: onStartPart,
                      child: const Text('Luyện theo Part'),
                    ),
                  ),
                ],
              )
            else
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: filter == TestFilter.fullTest
                      ? onStartFull
                      : onStartPart,
                  child: Text(
                    filter == TestFilter.fullTest
                        ? 'Chọn đề thi đầy đủ'
                        : 'Chọn Part để luyện tập',
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _LoadError extends StatelessWidget {
  const _LoadError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    );
  }
}
