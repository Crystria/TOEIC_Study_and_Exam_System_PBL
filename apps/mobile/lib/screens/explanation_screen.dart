import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

enum AnswerState { neutral, correct, wrongSelected }

class ExplanationOption {
  const ExplanationOption({
    required this.letter,
    required this.text,
    required this.state,
  });

  final String letter;
  final String text;
  final AnswerState state;
}

class AnswerExplanationScreen extends StatelessWidget {
  const AnswerExplanationScreen({super.key});

  // TODO: lấy từ GET /attempts/:attemptId (kèm giải thích câu hỏi)
  static const String _testLabel = 'Đề 05 · Full · 735 điểm';
  static const String _questionLabel = 'Câu 12 · Part 5';
  static const bool _isWrong = true;
  static const String _stem =
      'The manager asked all employees to submit their reports _____ Friday afternoon.';
  static const List<ExplanationOption> _options = [
    ExplanationOption(letter: 'A', text: 'in', state: AnswerState.neutral),
    ExplanationOption(letter: 'B', text: 'by', state: AnswerState.correct),
    ExplanationOption(
        letter: 'C', text: 'since', state: AnswerState.wrongSelected),
    ExplanationOption(letter: 'D', text: 'during', state: AnswerState.neutral),
  ];
  static const String _explanation =
      'B. by chỉ thời hạn, nghĩa là "chậm nhất vào". Báo cáo phải được nộp '
      'chậm nhất vào chiều Thứ Sáu.\n\nby + mốc thời gian = hạn chót\n'
      'Reports must be submitted by Friday.';
  static const List<String> _wrongReasons = [
    'since: chỉ mốc bắt đầu trong khoảng thời gian, không phải hạn nộp.',
    'during: đi với khoảng thời gian, không chỉ thời điểm hạn chót.',
    'in: không dùng với "Friday afternoon" như một ngày thường dùng "on", '
        'nhưng cả hai cũng không nghĩa là hạn chót.',
  ];

  void _onBackToResult(BuildContext context) {}
  void _onAskAi(BuildContext context) {}
  void _onPrev(BuildContext context) {}
  void _onNext(BuildContext context) {}

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => _onBackToResult(context),
                    child: const Row(
                      children: [
                        Icon(Icons.arrow_back, size: 16, color: AppColors.brand),
                        SizedBox(width: 4),
                        Text(
                          'Quay lại kết quả',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.brand),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'Lời giải chi tiết',
                    style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppColors.slate900),
                  ),
                  SizedBox(height: 2),
                  Text(
                    _testLabel,
                    style: TextStyle(fontSize: 13, color: AppColors.slate500),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.blueChipBg,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Text(
                                  _questionLabel,
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.blueChipFg),
                                ),
                              ),
                              if (_isWrong)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: AppColors.dangerBg,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Text(
                                    'Trả lời sai',
                                    style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.danger),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            _stem,
                            style: TextStyle(
                                fontSize: 15,
                                height: 1.5,
                                color: AppColors.slate900),
                          ),
                          const SizedBox(height: 14),
                          ..._options.map((o) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _OptionRow(option: o),
                          )),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Giải thích đáp án',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: AppColors.slate900),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: const Text(
                        _explanation,
                        style: TextStyle(
                            fontSize: 14,
                            height: 1.5,
                            color: AppColors.slate700),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Vì sao các đáp án khác sai?',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: AppColors.slate900),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: _wrongReasons
                            .map((r) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(
                            '•  $r',
                            style: const TextStyle(
                                fontSize: 13,
                                height: 1.45,
                                color: AppColors.slate700),
                          ),
                        ))
                            .toList(),
                      ),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () => _onAskAi(context),
                      child: const Text('Hỏi trợ lý AI về câu này'),
                    ),
                  ],
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _onPrev(context),
                      child: const Text('← Câu trước'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => _onNext(context),
                      child: const Text('Câu sau →'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OptionRow extends StatelessWidget {
  const _OptionRow({required this.option});
  final ExplanationOption option;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color border;
    Color fg;
    String? tag;

    switch (option.state) {
      case AnswerState.correct:
        bg = AppColors.successBg;
        border = AppColors.success;
        fg = AppColors.success;
        tag = 'Đáp án đúng';
        break;
      case AnswerState.wrongSelected:
        bg = AppColors.dangerBg;
        border = AppColors.danger;
        fg = AppColors.danger;
        tag = 'Bạn chọn · Sai';
        break;
      case AnswerState.neutral:
        bg = Colors.white;
        border = AppColors.border;
        fg = AppColors.slate900;
        tag = null;
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Row(
        children: [
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: fg,
              shape: BoxShape.circle,
            ),
            child: Text(
              option.letter,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.white),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              option.text,
              style: TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w600, color: fg),
            ),
          ),
          if (tag != null)
            Text(
              tag,
              style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600, color: fg),
            ),
        ],
      ),
    );
  }
}
