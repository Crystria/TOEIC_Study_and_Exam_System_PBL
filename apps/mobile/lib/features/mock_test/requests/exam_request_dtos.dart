/// Request DTOs for the Exam Service. Keeping payload shaping here prevents
/// screens and repositories from assembling transport JSON maps.
class StartPartAttemptRequest {
  const StartPartAttemptRequest({
    required this.parts,
    required this.durationSeconds,
  });

  final List<int> parts;
  final int durationSeconds;

  Map<String, dynamic> toJson() => {
    'parts': parts,
    'durationSeconds': durationSeconds,
  };
}

class SaveAnswerRequest {
  const SaveAnswerRequest({required this.selectedOption});

  final String? selectedOption;

  Map<String, dynamic> toJson() => {'selectedOption': selectedOption};
}

class SaveDraftRequest {
  const SaveDraftRequest({required this.answers});

  final Map<String, String?> answers;

  Map<String, dynamic> toJson() => {
    'answers': answers.entries
        .map(
          (entry) => {'questionId': entry.key, 'selectedOption': entry.value},
        )
        .toList(growable: false),
  };
}

class SubmitAttemptRequest extends SaveDraftRequest {
  const SubmitAttemptRequest({required super.answers});
}

class ExamHistoryQuery {
  const ExamHistoryQuery({
    required this.page,
    required this.size,
    this.testId,
    this.mode,
  });

  final int page;
  final int size;
  final String? testId;
  final String? mode;

  Map<String, dynamic> toQueryParameters() => {
    'page': page,
    'size': size,
    if (testId != null && testId!.trim().isNotEmpty) 'testId': testId,
    if (mode != null) 'mode': mode,
  };
}
