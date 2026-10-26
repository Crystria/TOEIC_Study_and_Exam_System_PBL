import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class VocabularyScreen extends StatefulWidget {
  const VocabularyScreen({super.key});

  @override
  State<VocabularyScreen> createState() => _VocabularyScreenState();
}

class _VocabularyScreenState extends State<VocabularyScreen> {
  // TODO: lấy từ GET /learning/review-today theo topicId
  static const _topicName = 'Office & Business';
  static const _currentIndex = 7; // thứ tự thẻ hiện tại (1-based)
  static const _totalCards = 20;
  static const _word = 'negotiate';
  static const _phonetic = "/nɪˈɡoʊʃiert/";
  static const _definition = 'thương lượng, đàm phán';
  static const _example = '"We need to negotiate the contract terms."';

  // TODO: phát audio_url của từ vựng
  void _onPlayAudio() {}

  // TODO: gửi quality (0/3/5) tới POST /learning/flashcards/:id/review,
  // nhận lại interval/nextReviewDate (SM-2) rồi chuyển sang thẻ kế tiếp
  void _onGrade(int quality) {}

  // TODO: mở màn chọn từ muốn ôn lại
  void _onReviewLearned() {}

  @override
  Widget build(BuildContext context) {
    final progress = _currentIndex / _totalCards;

    return Container(
      color: AppColors.bg,
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: tên chủ đề + vị trí thẻ
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    _topicName,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                  Text(
                    'Thẻ $_currentIndex/$_totalCards',
                    style: const TextStyle(fontSize: 13, color: AppColors.slate500),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 6,
                  backgroundColor: AppColors.border,
                  valueColor: const AlwaysStoppedAnimation(AppColors.brand),
                ),
              ),
              const SizedBox(height: 20),

              // Flashcard
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  children: [
                    const _Badge(
                      label: 'Từ mới',
                      bg: Color(0xFFDBEAFE),
                      fg: Color(0xFF1D4ED8),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      _word,
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w800,
                        color: AppColors.brand,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      _phonetic,
                      style: TextStyle(fontSize: 14, color: AppColors.slate500),
                    ),
                    const SizedBox(height: 14),
                    GestureDetector(
                      onTap: _onPlayAudio,
                      child: const _Badge(
                        label: '🔊  Nghe phát âm',
                        bg: Color(0xFFDBEAFE),
                        fg: Color(0xFF1D4ED8),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Container(height: 1, color: AppColors.border),
                    const SizedBox(height: 20),
                    const Text(
                      'ĐỊNH NGHĨA',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.slate400,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      _definition,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.slate900,
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      _example,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        fontStyle: FontStyle.italic,
                        color: AppColors.brand,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              const Text(
                'Bạn nhớ từ này ở mức nào?',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.slate900,
                ),
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: _GradeButton(
                      label: 'Chưa thuộc',
                      sub: 'Grade 1',
                      color: const Color(0xFFDC2626),
                      bg: const Color(0xFFFEF2F2),
                      onTap: () => _onGrade(1),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _GradeButton(
                      label: 'Mơ hồ',
                      sub: 'Grade 3',
                      color: const Color(0xFFD97706),
                      bg: const Color(0xFFFFFBEB),
                      onTap: () => _onGrade(3),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _GradeButton(
                      label: 'Đã thuộc',
                      sub: 'Grade 5',
                      color: const Color(0xFF16A34A),
                      bg: const Color(0xFFF0FDF4),
                      onTap: () => _onGrade(5),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              const Center(
                child: Text(
                  'Lần ôn kế tiếp được tính theo thuật toán SuperMemo-2',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: AppColors.slate400),
                ),
              ),
              const SizedBox(height: 20),

              Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: _onReviewLearned,
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Ôn lại từ đã học',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.slate900,
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'Chọn từ muốn ôn lại · 27 từ',
                                style: TextStyle(fontSize: 12, color: AppColors.slate500),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right, color: AppColors.slate400),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.bg, required this.fg});
  final String label;
  final Color bg;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: fg),
      ),
    );
  }
}

class _GradeButton extends StatelessWidget {
  const _GradeButton({
    required this.label,
    required this.sub,
    required this.color,
    required this.bg,
    required this.onTap,
  });
  final String label;
  final String sub;
  final Color color;
  final Color bg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withValues(alpha: 0.4)),
          ),
          child: Column(
            children: [
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                sub,
                style: TextStyle(fontSize: 11, color: color.withValues(alpha: 0.85)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
