import 'package:flutter/material.dart';

class OAuthButtonsRow extends StatelessWidget {
  const OAuthButtonsRow({
    super.key,
    required this.onGoogle,
    required this.onFacebook,
    this.enabled = true,
  });

  final VoidCallback onGoogle;
  final VoidCallback onFacebook;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: enabled ? onGoogle : null,
            child: const Text('Google'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: OutlinedButton(
            onPressed: enabled ? onFacebook : null,
            child: const Text('Facebook'),
          ),
        ),
      ],
    );
  }
}
