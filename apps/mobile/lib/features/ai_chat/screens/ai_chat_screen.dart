import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:toeic_mobile/features/ai_chat/screens/ai_chat_history_screen.dart';

import '../providers/ai_chat_history_provider.dart';
import '../providers/ai_chat_provider.dart';
import '../widgets/ai_chat_app_bar.dart';
import '../widgets/chat_bubble.dart';

import '../../../shared/widgets/chip_button.dart';
import '../../../shared/widgets/icon_badge_circle.dart';
import '../../../theme/app_colors.dart';

import '../models/ai_chat_failure.dart';
import '../models/chat_message.dart';

class AiChatScreen extends StatefulWidget {
  const AiChatScreen({super.key});

  @override
  State<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends State<AiChatScreen> {
  final TextEditingController _inputController = TextEditingController();

  final ScrollController _scrollController = ScrollController();
  AiChatProvider? _observedChatProvider;
  String? _lastConversationId;
  Object? _lastContextIdentity;

  bool _usageLoadScheduled = false;

  static const List<String> _suggestions = [
    'Phân biệt since vs for',
    'Giải thích mệnh đề quan hệ',
    'Mẹo làm Part 5 nhanh',
    'Từ vựng Office & Business',
  ];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    final provider = context.read<AiChatProvider>();

    // Chỉ lên lịch tải usage một lần tại một thời điểm.
    if (provider.usageStatus == UsageStatus.idle && !_usageLoadScheduled) {
      _usageLoadScheduled = true;

      WidgetsBinding.instance.addPostFrameCallback((_) {
        _usageLoadScheduled = false;

        if (!mounted) return;

        final currentProvider = context.read<AiChatProvider>();

        // Kiểm tra lại trạng thái trước khi tải để tránh
        // gọi trùng nếu một nơi khác đã bắt đầu tải usage.
        if (currentProvider.usageStatus == UsageStatus.idle) {
          unawaited(currentProvider.loadUsage());
        }
      });
    }

    // Đăng ký listener cho AiChatProvider.
    if (identical(provider, _observedChatProvider)) return;

    _observedChatProvider?.removeListener(_handleChatProviderChanged);

    _observedChatProvider = provider;
    _lastConversationId = provider.conversationId;
    _lastContextIdentity = provider.activeContext;

    provider.addListener(_handleChatProviderChanged);
  }

  void _handleChatProviderChanged() {
    final provider = _observedChatProvider;
    if (!mounted || provider == null) return;

    final conversationChanged = _lastConversationId != provider.conversationId;
    final contextChanged = !identical(
      _lastContextIdentity,
      provider.activeContext,
    );

    if (!conversationChanged && !contextChanged) return;

    _lastConversationId = provider.conversationId;
    _lastContextIdentity = provider.activeContext;
    _inputController.clear();
  }

  @override
  void dispose() {
    _observedChatProvider?.removeListener(_handleChatProviderChanged);
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _onNewConversation() async {
    final historyProvider = context.read<AiChatHistoryProvider>();
    final conversation = await historyProvider.createConversation();
    if (!mounted) return;

    if (conversation == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            historyProvider.operationErrorMessage ??
                'Không thể tạo cuộc trò chuyện mới.',
          ),
        ),
      );
      return;
    }

    await context.read<AiChatProvider>().loadConversation(conversation.id);
    if (!mounted) return;

    if (context.read<AiChatProvider>().status == ChatStatus.loaded) {
      _inputController.clear();
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Không thể mở cuộc trò chuyện mới.')),
    );
  }

  Future<void> _onConversationList() async {
    final conversationChanged = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const AiChatHistoryScreen()),
    );
    if (!mounted) return;
    if (conversationChanged == true) {
      _inputController.clear();
      _scrollToBottom();
    }
  }

  void _onSuggestion(String text) {
    _inputController.text = text;
  }

  Future<void> _onSend() async {
    final text = _inputController.text.trim();
    final provider = context.read<AiChatProvider>();
    if (text.isEmpty || !provider.canSend) return;

    final sendFuture = provider.sendMessage(text);
    _inputController.clear();
    _scrollToBottom();

    await sendFuture;
    if (!mounted) return;

    await context.read<AiChatHistoryProvider>().loadConversations(
      forceRefresh: true,
    );
    if (!mounted) return;
    _scrollToBottom();
  }

  Future<void> _onRetryMessage() async {
    final provider = context.read<AiChatProvider>();
    await provider.retryLastMessage();
    if (!mounted) return;

    await context.read<AiChatHistoryProvider>().loadConversations(
      forceRefresh: true,
    );
    if (!mounted) return;
    _scrollToBottom();
  }

  // Cuộn xuống tin nhắn mới nhất.
  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;

      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _onExplainMore() async {
    await _sendQuickAction('Giải thích thêm');
  }

  Future<void> _onGiveExample() async {
    await _sendQuickAction('Cho ví dụ khác');
  }

  Future<void> _sendQuickAction(String text) async {
    final provider = context.read<AiChatProvider>();
    if (!provider.canSend) return;

    await provider.sendMessage(text);
    if (!mounted) return;

    await context.read<AiChatHistoryProvider>().loadConversations(
      forceRefresh: true,
    );
    if (!mounted) return;
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AiChatProvider>();
    final contextLabel = provider.contextLabel;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: AiChatAppBar(
                title: 'Trợ lý AI TOEIC',
                remaining: provider.remainingMessages,
                limit: provider.dailyLimit,
                isUsageLoading: provider.isUsageLoading,
                usageIsPreview: provider.usageIsPreview,
                isQuotaBlocked: provider.isQuotaBlocked,
                onHistory: _onConversationList,
                onNewConversation: _onNewConversation,
              ),
            ),
            if (contextLabel != null && contextLabel.isNotEmpty)
              Container(
                margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.slate50,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.push_pin_outlined,
                      size: 14,
                      color: AppColors.slate400,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        contextLabel,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.slate500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (provider.isQuotaBlocked && provider.failure == null)
              _buildFailureNotice(
                const AiChatFailure(
                  kind: AiChatFailureKind.dailyQuotaExceeded,
                  message: 'Daily AI message quota exceeded.',
                ),
                resetAt: provider.usage.isAuthoritative
                    ? provider.usage.resetAt
                    : null,
                onRefreshQuota: () => provider.loadUsage(forceRefresh: true),
              ),
            if (provider.failure != null && provider.hasMessages)
              _buildFailureNotice(
                provider.failure!,
                resetAt: provider.usage.isAuthoritative
                    ? provider.usage.resetAt
                    : null,
                onRefreshQuota:
                    provider.failure?.kind ==
                        AiChatFailureKind.dailyQuotaExceeded
                    ? () => provider.loadUsage(forceRefresh: true)
                    : null,
              ),
            if (provider.usageFailure != null)
              _buildUsageFailureNotice(provider),
            Expanded(child: _buildBody(provider)),
            _buildInput(provider),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(AiChatProvider provider) {
    if (provider.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (provider.status == ChatStatus.error && !provider.hasMessages) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.chat_bubble_outline,
                size: 40,
                color: AppColors.slate400,
              ),
              const SizedBox(height: 12),
              Text(
                provider.errorMessage ?? 'Không thể tải cuộc trò chuyện.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.slate500),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: provider.conversationId == null
                    ? null
                    : () => provider.loadConversation(provider.conversationId!),
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      );
    }

    return provider.hasMessages
        ? _buildConversation(provider)
        : _buildEmptyState();
  }

  // Empty state: chưa có tin nhắn.
  Widget _buildEmptyState() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const IconBadgeCircle(icon: Icons.auto_awesome),

            const SizedBox(height: 16),

            const Text(
              'Xin chào! Mình là trợ lý AI TOEIC',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.slate900,
              ),
            ),

            const SizedBox(height: 4),

            const Text(
              'Hỏi mình về ngữ pháp, từ vựng hoặc câu hỏi bạn đang quan tâm.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppColors.slate500),
            ),

            const SizedBox(height: 20),

            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: _suggestions.map((suggestion) {
                return ChipButton(
                  label: suggestion,
                  onTap: () => _onSuggestion(suggestion),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  // Conversation: hiển thị tin nhắn.
  Widget _buildConversation(AiChatProvider provider) {
    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.all(16),
      itemCount: provider.messages.length,
      itemBuilder: (context, index) {
        final msg = provider.messages[index];

        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: msg.role == ChatRole.user
              ? UserChatBubble(
                  text: msg.text,
                  status: msg.status,
                  onRetry:
                      msg.status == ChatMessageStatus.failed &&
                          provider.canRetryLastMessage
                      ? _onRetryMessage
                      : null,
                  onEdit:
                      msg.status == ChatMessageStatus.failed &&
                          provider.failure?.kind ==
                              AiChatFailureKind.invalidRequest
                      ? () => _restoreFailedMessageForEditing(msg.text)
                      : null,
                )
              : AssistantChatBubble(
                  text: msg.text,
                  bullets: msg.bullets,
                  onExplainMore: provider.canSend ? _onExplainMore : null,
                  onGiveExample: provider.canSend ? _onGiveExample : null,
                ),
        );
      },
    );
  }

  void _restoreFailedMessageForEditing(String text) {
    _inputController
      ..text = text
      ..selection = TextSelection.collapsed(offset: text.length);
  }

  Widget _buildFailureNotice(
    AiChatFailure failure, {
    DateTime? resetAt,
    VoidCallback? onRefreshQuota,
  }) {
    final isQuota = failure.kind == AiChatFailureKind.dailyQuotaExceeded;
    final isRateLimited = failure.kind == AiChatFailureKind.rateLimited;
    final background = isQuota
        ? AppColors.dangerBg
        : isRateLimited
        ? AppColors.warningBg
        : Colors.white;
    final foreground = isQuota
        ? AppColors.danger
        : isRateLimited
        ? AppColors.warning
        : AppColors.slate700;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: foreground.withAlpha(46)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isQuota ? Icons.hourglass_disabled : Icons.info_outline,
            color: foreground,
            size: 18,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  failure.title,
                  style: TextStyle(
                    color: foreground,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  failure.userMessage,
                  style: TextStyle(color: foreground, fontSize: 12),
                ),
                if (isQuota && resetAt != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      'Làm mới dự kiến: ${_formatResetTime(resetAt)}',
                      style: TextStyle(color: foreground, fontSize: 11),
                    ),
                  ),
                if (isQuota && onRefreshQuota != null)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: onRefreshQuota,
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.only(top: 4),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text('Kiểm tra lại hạn mức'),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatResetTime(DateTime resetAt) {
    final hour = resetAt.hour.toString().padLeft(2, '0');
    final minute = resetAt.minute.toString().padLeft(2, '0');
    final day = resetAt.day.toString().padLeft(2, '0');
    final month = resetAt.month.toString().padLeft(2, '0');
    return '$hour:$minute · $day/$month';
  }

  Widget _buildUsageFailureNotice(AiChatProvider provider) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.warningBg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          const Icon(Icons.sync_problem, size: 17, color: AppColors.warning),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'Không thể cập nhật thông tin lượt sử dụng.',
              style: TextStyle(fontSize: 12, color: AppColors.slate700),
            ),
          ),
          TextButton(
            onPressed: provider.isUsageLoading
                ? null
                : () => provider.loadUsage(forceRefresh: true),
            child: const Text('Thử lại'),
          ),
        ],
      ),
    );
  }

  // Input dùng chung cho cả hai trạng thái.
  Widget _buildInput(AiChatProvider provider) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _inputController,
              enabled: provider.canSend,
              maxLength: 1000,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _onSend(),
              decoration: InputDecoration(
                hintText: provider.isQuotaBlocked
                    ? 'Bạn đã hết lượt nhắn hôm nay'
                    : provider.failure?.kind ==
                          AiChatFailureKind.conversationNotFound
                    ? 'Cuộc trò chuyện không còn tồn tại'
                    : provider.failure?.blocksSending == true
                    ? 'Cần xác thực tài khoản để tiếp tục'
                    : provider.hasFailedMessage &&
                          provider.failure?.isRetryable == true
                    ? 'Đang chờ gửi lại tin nhắn chưa thành công'
                    : 'Nhập câu hỏi (tối đa 1000 ký tự)',
                counterText: '',
              ),
            ),
          ),

          const SizedBox(width: 8),

          IconButton.filled(
            style: IconButton.styleFrom(backgroundColor: AppColors.brand),
            onPressed: provider.canSend ? _onSend : null,
            icon: const Icon(Icons.arrow_forward, color: Colors.white),
          ),
        ],
      ),
    );
  }
}
