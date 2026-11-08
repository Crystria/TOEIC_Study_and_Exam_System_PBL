import 'package:flutter/material.dart';

import '../../models/test_attempt.dart';
import '../../repositories/mock_test_attempt_repository.dart';
import '../../repositories/mock_test_repository.dart';
import 'test_history_detail_view.dart';

class TestHistoryDetailFullScreen extends StatelessWidget {
  const TestHistoryDetailFullScreen({
    super.key,
    required this.attemptId,
    required this.attemptRepository,
    required this.testRepository,
  });

  final String attemptId;
  final MockTestAttemptRepository attemptRepository;
  final MockTestRepository testRepository;

  @override
  Widget build(BuildContext context) {
    return TestHistoryDetailView(
      attemptId: attemptId,
      expectedMode: TestAttemptMode.full,
      attemptRepository: attemptRepository,
      testRepository: testRepository,
    );
  }
}
