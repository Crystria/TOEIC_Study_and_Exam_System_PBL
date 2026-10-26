import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      const _DashboardTab(),
      const _PlaceholderTab('Từ vựng'),
      const _PlaceholderTab('Thi thử'),
      const _PlaceholderTab('Trợ lý AI'),
    ];

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: IndexedStack(index: _tabIndex, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (i) => setState(() => _tabIndex = i),
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFFDBEAFE),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home, color: AppColors.brand),
            label: 'Trang chủ',
          ),
          NavigationDestination(
            icon: Icon(Icons.menu_book_outlined),
            selectedIcon: Icon(Icons.menu_book, color: AppColors.brand),
            label: 'Từ vựng',
          ),
          NavigationDestination(
            icon: Icon(Icons.edit_note_outlined),
            selectedIcon: Icon(Icons.edit_note, color: AppColors.brand),
            label: 'Thi thử',
          ),
          NavigationDestination(
            icon: Icon(Icons.smart_toy_outlined),
            selectedIcon: Icon(Icons.smart_toy, color: AppColors.brand),
            label: 'Trợ lý AI',
          ),
        ],
      ),
    );
  }
}

class _PlaceholderTab extends StatelessWidget {
  const _PlaceholderTab(this.title);
  final String title;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Text(title, style: const TextStyle(color: AppColors.slate500)),
      ),
    );
  }
}

class _DashboardTab extends StatelessWidget {
  const _DashboardTab();

  // TODO: lấy dữ liệu từ GET /analytics/progress, /analytics/prediction,
  // /analytics/weak-areas và /learning/progress
  static const _name = 'Hải';
  static const _predicted = 685;
  static const _maxScore = 990;

  // TODO: điều hướng khi bấm các thẻ luyện tập nhanh
  void _onQuick(String key) {}

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        children: [
          _Header(name: _name),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _PredictionCard(score: _predicted, max: _maxScore),
                const SizedBox(height: 12),
                const Row(
                  children: [
                    Expanded(
                      child: _StatCard(
                          value: '12', label: 'Ngày streak', color: Color(0xFFF59E0B)),
                    ),
                    SizedBox(width: 12),
                    Expanded(
                      child: _StatCard(
                          value: '248', label: 'Từ đã học', color: AppColors.brand),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Row(
                  children: [
                    Expanded(
                      child: _StatCard(
                          value: '14', label: 'Bài ngữ pháp', color: Color(0xFF16A34A)),
                    ),
                    SizedBox(width: 12),
                    Expanded(
                      child: _StatCard(
                          value: '5', label: 'Bài thi thử', color: Color(0xFF7C3AED)),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                const _SectionTitle('Luyện tập nhanh'),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _QuickTile(
                        title: 'Flashcard',
                        subtitle: 'Ôn 15 từ hôm nay',
                        bg: const Color(0xFFDBEAFE),
                        fg: const Color(0xFF1D4ED8),
                        onTap: () => _onQuick('flashcard'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _QuickTile(
                        title: 'Thi thử',
                        subtitle: 'Luyện theo Part · 15 phút',
                        bg: const Color(0xFFEDE9FE),
                        fg: const Color(0xFF6D28D9),
                        onTap: () => _onQuick('mock-test'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _QuickTile(
                        title: 'Ngữ pháp',
                        subtitle: '6 bài · 2 hoàn thành',
                        bg: const Color(0xFFDBEAFE),
                        fg: const Color(0xFF1D4ED8),
                        onTap: () => _onQuick('grammar'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _QuickTile(
                        title: 'Lịch sử',
                        subtitle: '5 bài đã làm',
                        bg: const Color(0xFFEDE9FE),
                        fg: const Color(0xFF6D28D9),
                        onTap: () => _onQuick('history'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                const _SectionTitle('Kỹ năng cần cải thiện'),
                const SizedBox(height: 12),
                const Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _WeakChip(
                        label: 'Part 5 · 62%',
                        bg: Color(0xFFFEE2E2),
                        fg: Color(0xFFB91C1C)),
                    _WeakChip(
                        label: 'Part 3 · 68%',
                        bg: Color(0xFFFEF3C7),
                        fg: Color(0xFFB45309)),
                    _WeakChip(
                        label: 'Part 7 · 71%',
                        bg: Color(0xFFFEF3C7),
                        fg: Color(0xFFB45309)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.name});
  final String name;

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
            'Xin chào, $name',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Hôm nay bạn đã ôn 18 từ và 1 bài ngữ pháp.',
            style: TextStyle(color: Color(0xFFDBEAFE), fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _CardBox extends StatelessWidget {
  const _CardBox({required this.child, this.padding = const EdgeInsets.all(16)});
  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: child,
    );
  }
}

class _PredictionCard extends StatelessWidget {
  const _PredictionCard({required this.score, required this.max});
  final int score;
  final int max;

  @override
  Widget build(BuildContext context) {
    return _CardBox(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Điểm TOEIC dự đoán',
              style: TextStyle(fontSize: 13, color: AppColors.slate500)),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '$score',
                style: const TextStyle(
                  fontSize: 44,
                  fontWeight: FontWeight.w800,
                  color: AppColors.brand,
                  height: 1.1,
                ),
              ),
              const SizedBox(width: 8),
              Text('/ $max',
                  style: const TextStyle(fontSize: 18, color: AppColors.slate400)),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: score / max,
              minHeight: 8,
              backgroundColor: AppColors.border,
              valueColor: const AlwaysStoppedAnimation(AppColors.brand),
            ),
          ),
          const SizedBox(height: 8),
          const Text('Dựa trên 3 bài thi thử trong 30 ngày gần nhất',
              style: TextStyle(fontSize: 12, color: AppColors.slate400)),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.value,
    required this.label,
    required this.color,
  });
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return _CardBox(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value,
              style: TextStyle(
                  fontSize: 26, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 13, color: AppColors.slate500)),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: const TextStyle(
            fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.slate900));
  }
}

class _QuickTile extends StatelessWidget {
  const _QuickTile({
    required this.title,
    required this.subtitle,
    required this.bg,
    required this.fg,
    required this.onTap,
  });
  final String title;
  final String subtitle;
  final Color bg;
  final Color fg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 84),
          padding: const EdgeInsets.all(16),
          alignment: Alignment.centerLeft,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800, color: fg)),
              const SizedBox(height: 4),
              Text(subtitle,
                  style: const TextStyle(fontSize: 12, color: AppColors.slate500)),
            ],
          ),
        ),
      ),
    );
  }
}

class _WeakChip extends StatelessWidget {
  const _WeakChip({required this.label, required this.bg, required this.fg});
  final String label;
  final Color bg;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 12, fontWeight: FontWeight.w600, color: fg)),
    );
  }
}
