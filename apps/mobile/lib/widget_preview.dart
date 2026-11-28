import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import 'theme/app_colors.dart';

@Preview(name: 'TOEIC Master - Brand Color')
Widget brandColorPreview() {
  return const MaterialApp(
    home: Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.school, size: 64, color: AppColors.brand),
            SizedBox(height: 12),
            Text(
              'TOEIC Master',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppColors.brand,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
