import 'package:flutter/material.dart';

import '../../models/test_attempt.dart';
import 'test_history_detail_view.dart';

class TestHistoryDetailPartScreen extends StatelessWidget {
  const TestHistoryDetailPartScreen({super.key, required this.attemptId});

  final String attemptId;

  @override
  Widget build(BuildContext context) {
    return TestHistoryDetailView(
      attemptId: attemptId,
      expectedMode: TestAttemptMode.part,
    );
  }
}
