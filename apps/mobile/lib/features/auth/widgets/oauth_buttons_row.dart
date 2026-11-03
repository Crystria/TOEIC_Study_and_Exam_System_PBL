import 'package:flutter/material.dart';

class OAuthButtonsRow extends StatelessWidget {
  const OAuthButtonsRow({
    super.key,
    required this.onGoogle,
    required this.onFacebook,
  });

  final VoidCallback onGoogle;
  final VoidCallback onFacebook;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: onGoogle,
            child: const Text('Google'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: OutlinedButton(
            onPressed: onFacebook,
            child: const Text('Facebook'),
          ),
        ),
      ],
    );
  }
}
