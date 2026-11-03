import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

enum OptionState { neutral, selected, correct, wrongSelected }

class AnswerOptionTile extends StatelessWidget {
  const AnswerOptionTile({
    super.key,
    required this.letter,
    required this.text,
    required this.state,
    this.tag,
    this.onTap,
  });

  final String letter;
  final String text;
  final OptionState state;
  final String? tag;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    late Color bg;
    late Color border;
    late Color fg;
    late Color circleColor;
    late Color circleFg;

    switch (state) {
      case OptionState.neutral:
        bg = Colors.white;
        border = AppColors.border;
        fg = AppColors.slate900;
        circleColor = AppColors.slate50;
        circleFg = AppColors.slate500;
        break;
      case OptionState.selected:
        bg = AppColors.blueChipBg;
        border = AppColors.brand;
        fg = AppColors.slate900;
        circleColor = AppColors.brand;
        circleFg = Colors.white;
        break;
      case OptionState.correct:
        bg = AppColors.successBg;
        border = AppColors.success;
        fg = AppColors.success;
        circleColor = AppColors.success;
        circleFg = Colors.white;
        break;
      case OptionState.wrongSelected:
        bg = AppColors.dangerBg;
        border = AppColors.danger;
        fg = AppColors.danger;
        circleColor = AppColors.danger;
        circleFg = Colors.white;
        break;
    }

    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: border,
              width: state == OptionState.neutral ? 1 : 1.5,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: circleColor,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  letter,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: circleFg,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  text,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: state == OptionState.neutral
                        ? FontWeight.w500
                        : FontWeight.w700,
                    color: fg,
                  ),
                ),
              ),
              if (tag != null)
                Text(
                  tag!,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: fg,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
