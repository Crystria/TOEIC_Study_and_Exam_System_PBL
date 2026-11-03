import 'package:flutter/material.dart';

import '../../../../theme/app_colors.dart';

class QuantityStepper extends StatelessWidget {
  const QuantityStepper({
    super.key,
    required this.value,
    required this.onDecrease,
    required this.onIncrease,
    this.suffix,
  });

  final int value;
  final VoidCallback onDecrease;
  final VoidCallback onIncrease;
  final String? suffix;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _RoundIconButton(icon: Icons.remove, onTap: onDecrease),
            Container(
              width: 100,
              alignment: Alignment.center,
              child: Text(
                '$value',
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: AppColors.brand,
                ),
              ),
            ),
            _RoundIconButton(icon: Icons.add, onTap: onIncrease),
          ],
        ),
        if (suffix != null) ...[
          const SizedBox(height: 4),
          Center(
            child: Text(
              suffix!,
              style: const TextStyle(fontSize: 12, color: AppColors.slate400),
            ),
          ),
        ],
      ],
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.slate50,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          child: Icon(icon, color: AppColors.slate700),
        ),
      ),
    );
  }
}
