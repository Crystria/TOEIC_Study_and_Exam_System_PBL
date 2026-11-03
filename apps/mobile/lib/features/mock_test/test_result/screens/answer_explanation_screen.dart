import 'package:flutter/material.dart';
import 'package:toeic_mobile/core/navigation/app_navigation_state.dart';

import '../../../../shared/widgets/text_link_button.dart';
import '../../../../shared/widgets/answer_option_tile.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../theme/app_colors.dart';
import '../../../ai_chat/screens/ai_chat_screen.dart';
import '../../../home/screens/home_screen.dart';

class AnswerExplanationScreen extends StatelessWidget {
  const AnswerExplanationScreen({super.key});

  static const String _testLabel = 'Đề 05 · Full · 735 điểm';
  static const String _questionLabel = 'Câu 12 · Part 5';
  static const bool _isWrong = true;
  static const String _stem =
      'The manager asked all employees to submit their reports _____ Friday afternoon.';
  static const List<_Option> _options = [
    _Option(letter: 'A', text: 'in', state: OptionState.neutral),
    _Option(letter: 'B', text: 'by', state: OptionState.correct),
    _Option(letter: 'C', text: 'since', state: OptionState.wrongSelected),
    _Option(letter: 'D', text: 'during', state: OptionState.neutral),
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

  void _onBackToResult(BuildContext context) {
    Navigator.of(context, rootNavigator: true).pop();
  }

  void _onAskAi(BuildContext context) {
    Navigator.of(
      context,
      rootNavigator: true,
    ).popUntil((route) => route.isFirst);

    AppNavigationState.showBottomNavigation();
    AppNavigationState.requestTab(3);
  }

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
              child: TextLinkButton(
                label: 'Quay lại kết quả',
                leadingIcon: Icons.arrow_back,
                centered: false,
                onTap: () => _onBackToResult(context),
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
                      color: AppColors.slate900,
                    ),
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
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const AppBadge(
                                label: _questionLabel,
                                bg: AppColors.blueChipBg,
                                fg: AppColors.blueChipFg,
                              ),
                              if (_isWrong)
                                const AppBadge(
                                  label: 'Trả lời sai',
                                  bg: AppColors.dangerBg,
                                  fg: AppColors.danger,
                                ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            _stem,
                            style: TextStyle(
                              fontSize: 15,
                              height: 1.5,
                              color: AppColors.slate900,
                            ),
                          ),
                          const SizedBox(height: 14),
                          ..._options.map(
                            (o) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: AnswerOptionTile(
                                letter: o.letter,
                                text: o.text,
                                state: o.state,
                                tag: o.state == OptionState.correct
                                    ? 'Đáp án đúng'
                                    : o.state == OptionState.wrongSelected
                                    ? 'Bạn chọn · Sai'
                                    : null,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Giải thích đáp án',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.slate900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const AppCard(
                      child: Text(
                        _explanation,
                        style: TextStyle(
                          fontSize: 14,
                          height: 1.5,
                          color: AppColors.slate700,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Vì sao các đáp án khác sai?',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.slate900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: _wrongReasons
                            .map(
                              (r) => Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Text(
                                  '•  $r',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    height: 1.45,
                                    color: AppColors.slate700,
                                  ),
                                ),
                              ),
                            )
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

class _Option {
  const _Option({
    required this.letter,
    required this.text,
    required this.state,
  });
  final String letter;
  final String text;
  final OptionState state;
}
