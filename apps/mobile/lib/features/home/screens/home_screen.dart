import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:toeic_mobile/features/profile/screens/profile_screen.dart';

import '../../../core/navigation/app_navigation_state.dart';
import '../../ai_chat/screens/ai_chat_screen.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../learning/screens/grammar/grammar_list_screen.dart';
import '../../learning/screens/vocabulary/vocabulary_topics_screen.dart';
import '../../mock_test/screens/test_history/test_history_screen.dart';
import '../../mock_test/screens/test_selection/mock_test_select_screen.dart';
import '../providers/home_provider.dart';
import '../widgets/prediction_score_card.dart';
import '../widgets/quick_action_tile.dart';
import '../widgets/section_title.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_bottom_nav.dart';
import '../../../shared/widgets/stat_card.dart';
import '../../../theme/app_colors.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.loginRouteBuilder});

  final WidgetBuilder loginRouteBuilder;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tabIndex = 0;
  bool _isHandlingBack = false;
  bool _isRedirectingToLogin = false;
  final _navKeys = List.generate(5, (_) => GlobalKey<NavigatorState>());

  @override
  void initState() {
    super.initState();

    AppNavigationState.requestedTabIndex.addListener(_handleTabChange);
  }

  void _handleTabChange() {
    final index = AppNavigationState.requestedTabIndex.value;
    if (index == null) return;

    if (index >= 0 && index < _navKeys.length && mounted) {
      // A cross-feature request (for example, asking AI from a Grammar lesson
      // or Mock Test result) must display the destination tab's root screen.
      // The target tab may still have a nested route such as Chat History on
      // top of AiChatScreen because manual tab switching preserves each stack.
      // Reset only this programmatically requested destination; ordinary
      // bottom-navigation taps keep their existing stack-preserving behavior.
      _popTabToRoot(index);

      if (_tabIndex != index) {
        setState(() => _tabIndex = index);
      }
    }

    // Clear the request after processing it, including invalid indices.
    AppNavigationState.requestedTabIndex.value = null;
  }

  @override
  void dispose() {
    AppNavigationState.requestedTabIndex.removeListener(_handleTabChange);
    super.dispose();
  }

  /// HomeScreen là container của toàn bộ khu vực cần xác thực.
  /// Nếu session không còn hợp lệ, không render nội dung tab và đưa
  /// root Navigator về Login.
  void _redirectToLoginAfterFrame() {
    if (_isRedirectingToLogin) return;
    _isRedirectingToLogin = true;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;

      // Session có thể đã được khôi phục trước khi callback chạy.
      if (context.read<AuthSessionProvider>().isAuthenticated) {
        _isRedirectingToLogin = false;
        return;
      }

      Navigator.of(context, rootNavigator: true).pushAndRemoveUntil(
        MaterialPageRoute<void>(builder: widget.loginRouteBuilder),
        (_) => false,
      );
    });
  }

  void _popTabToRoot(int index) {
    if (index < 0 || index >= _navKeys.length) return;
    _navKeys[index].currentState?.popUntil((route) => route.isFirst);
  }

  void _onQuick(String key) {
    switch (key) {
      case 'flashcard':
        _popTabToRoot(1);
        _goToTab(1);
        break;
      case 'mock-test':
        _popTabToRoot(2);
        _goToTab(2);
        break;
      case 'grammar':
        _popTabToRoot(0);
        _goToTab(0);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _navKeys[0].currentState?.push(
            MaterialPageRoute<void>(builder: (_) => const GrammarListScreen()),
          );
        });
        break;
      case 'history':
        _popTabToRoot(2);
        _goToTab(2);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _navKeys[2].currentState?.push(
            MaterialPageRoute<void>(builder: (_) => const TestHistoryScreen()),
          );
        });
        break;
    }
  }

  void _onSelectTab(int index) {
    if (index < 0 || index >= _navKeys.length) return;

    // Reselecting the active tab returns that tab to its root. Switching to a
    // different tab preserves its independent navigation stack.
    if (index == _tabIndex) {
      _popTabToRoot(index);
    }

    if (_tabIndex != index) {
      setState(() => _tabIndex = index);
    }
  }

  void _goToTab(int index) {
    if (index < 0 || index >= _navKeys.length || index == _tabIndex) return;
    setState(() => _tabIndex = index);
  }

  Future<void> _handleSystemBack(bool didPop) async {
    if (didPop || _isHandlingBack) return;
    _isHandlingBack = true;

    try {
      final currentNavigator = _navKeys[_tabIndex].currentState;
      if (currentNavigator != null && await currentNavigator.maybePop()) {
        return;
      }

      if (!mounted) return;

      // At a tab root, Back returns to Dashboard. At Dashboard root, it exits.
      if (_tabIndex != 0) {
        setState(() => _tabIndex = 0);
      } else {
        await SystemNavigator.pop();
      }
    } finally {
      _isHandlingBack = false;
    }
  }

  Widget _tabNavigator(int i, Widget root) => Navigator(
    key: _navKeys[i],
    onGenerateRoute: (_) => MaterialPageRoute(builder: (_) => root),
  );

  @override
  Widget build(BuildContext context) {
    final isAuthenticated = context.select<AuthSessionProvider, bool>(
      (provider) => provider.isAuthenticated,
    );

    if (!isAuthenticated) {
      _redirectToLoginAfterFrame();
      return const Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(child: CircularProgressIndicator()),
      );
    }

    _isRedirectingToLogin = false;

    return ChangeNotifierProvider(
      create: (_) => HomeProvider(),
      child: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          _handleSystemBack(didPop);
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
              _tabNavigator(
                4,
                ProfileScreen(loginRouteBuilder: widget.loginRouteBuilder),
              ),
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
                Text(
                  provider.errorMessage ?? 'Đã có lỗi xảy ra',
                  style: const TextStyle(color: AppColors.slate500),
                ),
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
        Row(
          children: [
            Expanded(
              child: StatCard(
                value: '${data.streakDays}',
                label: 'Ngày streak',
                color: AppColors.amber,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: StatCard(
                value: '${data.vocabLearned}',
                label: 'Từ đã học',
                color: AppColors.brand,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: StatCard(
                value: '${data.lessonsDone}',
                label: 'Bài ngữ pháp',
                color: AppColors.success,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: StatCard(
                value: '${data.mockTestCount}',
                label: 'Bài thi thử',
                color: AppColors.purpleChipFg,
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        const SectionTitle('Luyện tập nhanh'),
        const SizedBox(height: 12),
        Row(
          children: [
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
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
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
          ],
        ),
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
                  bg: w.accuracy < 65
                      ? AppColors.dangerBg
                      : AppColors.warningBg,
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
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w800,
            ),
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
