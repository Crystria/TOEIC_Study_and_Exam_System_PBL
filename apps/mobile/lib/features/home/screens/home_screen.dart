import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/navigation/app_navigation_state.dart';
import '../../ai_chat/screens/ai_chat_screen.dart';
import '../../learning/grammar/screens/grammar_list_screen.dart';
import '../../learning/vocabulary/screens/vocabulary_topics_screen.dart';
import '../../mock_test/test_history/screens/test_history_screen.dart';
import '../../mock_test/test_selection/screens/mock_test_select_screen.dart';
import '../providers/home_provider.dart';
import '../widgets/prediction_score_card.dart';
import '../widgets/quick_action_tile.dart';
import '../widgets/section_title.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_bottom_nav.dart';
import '../../../shared/widgets/stat_card.dart';
import '../../../theme/app_colors.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class HomeShell extends InheritedWidget {
  const HomeShell({super.key, required this.goToTab, required super.child});

  final void Function(int index) goToTab;

  static HomeShell of(BuildContext context) {
    final shell = context.dependOnInheritedWidgetOfExactType<HomeShell>();
    assert(shell != null, 'Không nằm trong HomeScreen');
    return shell!;
  }

  @override
  bool updateShouldNotify(HomeShell old) => false;
}

class _HomeScreenState extends State<HomeScreen> {
  int _tabIndex = 0;
  final _navKeys = List.generate(4, (_) => GlobalKey<NavigatorState>());

  @override
  void initState() {
    super.initState();

    AppNavigationState.requestedTabIndex.addListener(
      _handleTabChange,
    );
  }

  void _handleTabChange() {
    final index = AppNavigationState.requestedTabIndex.value;

    if (index == null || !mounted) return;

    setState(() {
      _tabIndex = index;
    });

    // Xóa yêu cầu đã xử lý.
    AppNavigationState.requestedTabIndex.value = null;
  }

  @override
  void dispose() {
    AppNavigationState.requestedTabIndex.removeListener(
      _handleTabChange,
    );

    super.dispose();
  }

  void _onQuick(String key) {
    switch (key) {
      case 'flashcard':
        _navKeys[1].currentState?.popUntil(
              (route) => route.isFirst,
        );

        setState(() => _tabIndex = 1);
        break;

      case 'mock-test':
        _navKeys[2].currentState?.popUntil(
              (route) => route.isFirst,
        );

        setState(() => _tabIndex = 2);
        break;

      case 'grammar':
        setState(() => _tabIndex = 0);

        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;

          _navKeys[0].currentState?.push(
            MaterialPageRoute(
              builder: (_) => const GrammarListScreen(),
            ),
          );
        });
        break;

      case 'history':
        _navKeys[2].currentState?.popUntil(
              (route) => route.isFirst,
        );

        setState(() => _tabIndex = 2);

        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;

          _navKeys[2].currentState?.push(
            MaterialPageRoute(
              builder: (_) => const TestHistoryScreen(),
            ),
          );
        });
        break;
    }

    void _backToHome() {
      for (final key in _navKeys) {
        key.currentState?.popUntil(
              (route) => route.isFirst,
        );
      }

      setState(() {
        _tabIndex = 0;
      });
    }
  }

  void _onSelectTab(int i) {
    // Bấm lại tab đang mở -> về màn gốc của tab
    _navKeys[i].currentState?.popUntil((r) => r.isFirst);
    setState(() => _tabIndex = i);
  }

  void _goToTab(int i) {
    for (final k in _navKeys) {
      k.currentState?.popUntil((r) => r.isFirst); // về màn gốc của mọi tab
    }
    setState(() => _tabIndex = i);
  }

  Widget _tabNavigator(int i, Widget root) => Navigator(
    key: _navKeys[i],
    onGenerateRoute: (_) => MaterialPageRoute(builder: (_) => root),
  );

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => HomeProvider(),
      child: HomeShell(
        goToTab: _goToTab,
        child: PopScope(
          canPop: false,
          onPopInvokedWithResult: (didPop, _) async {
            if (didPop) return;
            // Back: ưu tiên pop trong tab -> về tab Trang chủ -> thoát app
            if (await _navKeys[_tabIndex].currentState!.maybePop()) return;
            if (_tabIndex != 0) {
              setState(() => _tabIndex = 0);
            } else {
              SystemNavigator.pop();
            }
          },
          child: Scaffold(
            backgroundColor: AppColors.bg,
            resizeToAvoidBottomInset: false,
            body: IndexedStack(
              index: _tabIndex,
              children: [
                _tabNavigator(0, _DashboardTab(onQuick: _onQuick)),
                _tabNavigator(1, const VocabularyTopicsScreen()),
                _tabNavigator(2, const MockTestSelectScreen()),
                _tabNavigator(3, const AiChatScreen()),
              ],
            ),
            bottomNavigationBar: ValueListenableBuilder<bool>(
              valueListenable: AppNavigationState.isFullScreenFlow,
              builder: (context, isHidden, child) {
                if (isHidden) {
                  return const SizedBox.shrink();
                }

                return AppBottomNav(
                  currentIndex: _tabIndex,
                  onSelect: _onSelectTab,
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _DashboardTab extends StatefulWidget {
  const _DashboardTab({required this.onQuick});
  final void Function(String key) onQuick;

  @override
  State<_DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<_DashboardTab> {
  @override
  void initState() {
    super.initState();
    // Tải lần đầu sau frame đầu tiên (không gọi context.read trực tiếp trong initState)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<HomeProvider>().loadDashboard();
    });
  }

  Future<void> _onRefresh() async {
    final provider = context.read<HomeProvider>();
    await provider.loadDashboard();
    if (!mounted) return;
    if (provider.status == HomeStatus.error && provider.errorMessage != null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(provider.errorMessage!)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<HomeProvider>();
    final data = provider.data;

    // Chưa có dữ liệu: loading / lỗi lần đầu
    if (data == null) {
      if (provider.status == HomeStatus.error) {
        return SafeArea(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(provider.errorMessage ?? 'Đã có lỗi xảy ra',
                    style: const TextStyle(color: AppColors.slate500)),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: provider.loadDashboard,
                  child: const Text('Thử lại'),
                ),
              ],
            ),
          ),
        );
      }
      return const Center(child: CircularProgressIndicator());
    }

    return RefreshIndicator(
      onRefresh: _onRefresh,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          children: [
            _Header(data: data),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              child: _Content(data: data, onQuick: widget.onQuick),
            ),
          ],
        ),
      ),
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.data, required this.onQuick});
  final DashboardData data;
  final void Function(String key) onQuick;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (data.predictedScore != null)
          PredictionScoreCard(
            score: data.predictedScore!,
            max: 990,
            note: 'Dựa trên 3 bài thi thử trong 30 ngày gần nhất',
          )
        else
          const _PredictionLocked(),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: StatCard(
                value: '${data.streakDays}',
                label: 'Ngày streak',
                color: AppColors.amber),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: StatCard(
                value: '${data.vocabLearned}',
                label: 'Từ đã học',
                color: AppColors.brand),
          ),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: StatCard(
                value: '${data.lessonsDone}',
                label: 'Bài ngữ pháp',
                color: AppColors.success),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: StatCard(
                value: '${data.mockTestCount}',
                label: 'Bài thi thử',
                color: AppColors.purpleChipFg),
          ),
        ]),
        const SizedBox(height: 24),
        const SectionTitle('Luyện tập nhanh'),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: QuickActionTile(
              title: 'Flashcard',
              subtitle: data.dueFlashcards > 0
                  ? 'Ôn ${data.dueFlashcards} từ hôm nay'
                  : 'Học từ mới',
              bg: AppColors.blueChipBg,
              fg: AppColors.blueChipFg,
              onTap: () => onQuick('flashcard'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: QuickActionTile(
              title: 'Thi thử',
              subtitle: 'Luyện theo Part · 15 phút',
              bg: AppColors.purpleChipBg,
              fg: AppColors.purpleChipFg,
              onTap: () => onQuick('mock-test'),
            ),
          ),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: QuickActionTile(
              title: 'Ngữ pháp',
              subtitle: '${data.lessonsDone} bài hoàn thành',
              bg: AppColors.blueChipBg,
              fg: AppColors.blueChipFg,
              onTap: () => onQuick('grammar'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: QuickActionTile(
              title: 'Lịch sử',
              subtitle: '${data.mockTestCount} bài đã làm',
              bg: AppColors.purpleChipBg,
              fg: AppColors.purpleChipFg,
              onTap: () => onQuick('history'),
            ),
          ),
        ]),
        if (data.weakAreas.isNotEmpty) ...[
          const SizedBox(height: 24),
          const SectionTitle('Kỹ năng cần cải thiện'),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final w in data.weakAreas)
                AppPillBadge(
                  label: '${w.label} · ${w.accuracy}%',
                  bg: w.accuracy < 65 ? AppColors.dangerBg : AppColors.warningBg,
                  fg: w.accuracy < 65 ? AppColors.danger : AppColors.warning,
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _PredictionLocked extends StatelessWidget {
  const _PredictionLocked();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: const Text(
        'Làm ít nhất 3 bài thi thử trong 30 ngày để xem điểm TOEIC dự đoán.',
        style: TextStyle(color: AppColors.slate500, fontSize: 13),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.data});
  final DashboardData data;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    return Container(
      width: double.infinity,
      color: AppColors.brand,
      padding: EdgeInsets.fromLTRB(20, top + 24, 20, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Xin chào, ${data.userName}',
            style: const TextStyle(
                color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            'Hôm nay bạn đã ôn ${data.todayVocab} từ và ${data.todayLessons} bài ngữ pháp.',
            style: const TextStyle(color: Color(0xFFDBEAFE), fontSize: 13),
          ),
        ],
      ),
    );
  }
}
