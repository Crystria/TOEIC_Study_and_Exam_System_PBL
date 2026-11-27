import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';

class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    required this.controller,
    this.hintText = '••••••••',
    this.textInputAction = TextInputAction.next,
    this.onSubmitted,
    this.autofillHints,
    this.validator,
    this.enabled = true,
  });

  final TextEditingController controller;
  final String hintText;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onSubmitted;
  final List<String>? autofillHints;
  final String? Function(String?)? validator;
  final bool enabled;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      obscureText: _obscure,
      enabled: widget.enabled,
      textInputAction: widget.textInputAction,
      onFieldSubmitted: widget.onSubmitted,
      autofillHints: widget.autofillHints,
      validator: widget.validator,
      decoration: InputDecoration(
        hintText: widget.hintText,
        suffixIcon: IconButton(
          icon: Icon(
            _obscure
                ? Icons.visibility_off_outlined
                : Icons.visibility_outlined,
            color: AppColors.slate400,
            size: 20,
          ),
          onPressed: widget.enabled
              ? () => setState(() => _obscure = !_obscure)
              : null,
        ),
      ),
    );
  }
}
