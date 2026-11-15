import 'package:flutter/material.dart';

import '../../models/vocabulary_session_dtos.dart';
import '../../providers/vocabulary_topic_provider.dart';

class QuickQuizLaunchConfig {
  const QuickQuizLaunchConfig({required this.topicId, required this.mode});

  final String topicId;
  final VocabularySessionMode mode;
}

class QuickQuizLaunchDialog {
  const QuickQuizLaunchDialog._();

  static Future<QuickQuizLaunchConfig?> show(
    BuildContext context, {
    required List<TopicSummary> topics,
    String? initialTopicId,
    VocabularySessionMode initialMode = VocabularySessionMode.review,
  }) {
    if (topics.isEmpty) return Future.value(null);

    var selectedTopicId = topics.any((item) => item.id == initialTopicId)
        ? initialTopicId!
        : topics.first.id;
    var selectedMode = initialMode;

    return showDialog<QuickQuizLaunchConfig>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Thiết lập Quick Quiz'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Chủ đề'),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: selectedTopicId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                  ),
                  items: topics
                      .map(
                        (topic) => DropdownMenuItem<String>(
                          value: topic.id,
                          child: Text(
                            topic.name,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(growable: false),
                  onChanged: (value) {
                    if (value == null) return;
                    setDialogState(() => selectedTopicId = value);
                  },
                ),
                const SizedBox(height: 18),
                const Text('Loại Session'),
                RadioListTile<VocabularySessionMode>(
                  contentPadding: EdgeInsets.zero,
                  value: VocabularySessionMode.newWords,
                  groupValue: selectedMode,
                  onChanged: (value) {
                    if (value != null) {
                      setDialogState(() => selectedMode = value);
                    }
                  },
                  title: const Text('NEW – Từ chưa có tiến trình'),
                  subtitle: const Text('Backend chọn 5 từ mới thuộc chủ đề.'),
                ),
                RadioListTile<VocabularySessionMode>(
                  contentPadding: EdgeInsets.zero,
                  value: VocabularySessionMode.review,
                  groupValue: selectedMode,
                  onChanged: (value) {
                    if (value != null) {
                      setDialogState(() => selectedMode = value);
                    }
                  },
                  title: const Text('REVIEW – Từ đến hạn ôn'),
                  subtitle: const Text('Backend chọn 5 từ đã đến lịch ôn.'),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Backend quyết định danh sách từ đủ điều kiện. Nếu chủ đề không có đủ 5 từ phù hợp, ứng dụng sẽ hiển thị lỗi và không tự chuyển sang dữ liệu khác.',
                  style: TextStyle(fontSize: 12, color: Colors.black54),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Hủy'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(dialogContext).pop(
                QuickQuizLaunchConfig(
                  topicId: selectedTopicId,
                  mode: selectedMode,
                ),
              ),
              child: const Text('Bắt đầu'),
            ),
          ],
        ),
      ),
    );
  }
}
