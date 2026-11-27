import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/ai_conversation.dart';
import '../providers/ai_chat_history_provider.dart';
import '../providers/ai_chat_provider.dart';
import '../widgets/ai_chat_app_bar.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../theme/app_colors.dart';

enum _ConversationMenuAction { rename, delete }

class AiChatHistoryScreen extends StatefulWidget {
  const AiChatHistoryScreen({super.key});

  @override
  State<AiChatHistoryScreen> createState() => _AiChatHistoryScreenState();
}

class _AiChatHistoryScreenState extends State<AiChatHistoryScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = context.read<AiChatHistoryProvider>();
      if (provider.status == HistoryStatus.idle) {
        provider.loadConversations();
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _onRefresh() {
    return context.read<AiChatHistoryProvider>().loadConversations(
      forceRefresh: true,
    );
  }

  Future<void> _onOpenConversation(AiConversation conversation) async {
    final chatProvider = context.read<AiChatProvider>();
    await chatProvider.loadConversation(conversation.id);

    if (!mounted) return;

    if (chatProvider.status == ChatStatus.loaded) {
      Navigator.of(context).pop(true);
      return;
    }

    // The selected record may have been removed after this list was loaded.
    final message =
        chatProvider.errorMessage ?? 'Cuộc trò chuyện không còn tồn tại.';
    chatProvider.clearConversation();
    await context.read<AiChatHistoryProvider>().loadConversations(
      forceRefresh: true,
    );
    if (!mounted) return;

    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _onNewConversation() async {
    final historyProvider = context.read<AiChatHistoryProvider>();
    final conversation = await historyProvider.createConversation();

    if (!mounted) return;

    if (conversation == null) {
      _showMessage(
        historyProvider.operationErrorMessage ??
            'Không thể tạo cuộc trò chuyện mới.',
      );
      return;
    }

    final chatProvider = context.read<AiChatProvider>();
    await chatProvider.loadConversation(conversation.id);
    if (!mounted) return;

    if (chatProvider.status == ChatStatus.loaded) {
      Navigator.of(context).pop(true);
      return;
    }

    _showMessage('Đã tạo hội thoại nhưng không thể mở cuộc trò chuyện.');
  }

  Future<void> _onRenameConversation(AiConversation conversation) async {
    final newTitle = await showDialog<String>(
      context: context,
      builder: (_) =>
          _RenameConversationDialog(initialTitle: conversation.title),
    );

    if (!mounted || newTitle == null) return;

    final provider = context.read<AiChatHistoryProvider>();
    final success = await provider.renameConversation(
      conversation.id,
      newTitle,
    );
    if (!mounted) return;

    _showMessage(
      success
          ? 'Đã đổi tên cuộc trò chuyện.'
          : provider.operationErrorMessage ??
                'Không thể đổi tên cuộc trò chuyện.',
    );
  }

  Future<void> _onDeleteConversation(AiConversation conversation) async {
    final shouldDelete = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Xóa cuộc trò chuyện?'),
        content: Text(
          'Bạn có chắc muốn xóa "${conversation.title}"? '
          'Thao tác này không thể hoàn tác trong phiên ứng dụng hiện tại.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );

    if (!mounted || shouldDelete != true) return;

    final historyProvider = context.read<AiChatHistoryProvider>();
    final success = await historyProvider.deleteConversation(conversation.id);
    if (!mounted) return;

    if (!success) {
      _showMessage(
        historyProvider.operationErrorMessage ??
            'Không thể xóa cuộc trò chuyện.',
      );
      return;
    }

    final chatProvider = context.read<AiChatProvider>();
    if (chatProvider.conversationId == conversation.id) {
      chatProvider.clearConversation();
    }
    _showMessage('Đã xóa cuộc trò chuyện.');
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final history = context.watch<AiChatHistoryProvider>();
    final chat = context.watch<AiChatProvider>();

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: AiChatAppBar(
                title: 'Lịch sử trò chuyện',
                remaining: chat.remainingMessages,
                limit: chat.dailyLimit,
                isUsageLoading: chat.isUsageLoading,
                usageIsPreview: chat.usageIsPreview,
                isQuotaBlocked: chat.isQuotaBlocked,
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: history.isCreating ? null : _onNewConversation,
                  icon: history.isCreating
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.add),
                  label: Text(
                    history.isCreating
                        ? 'Đang tạo cuộc trò chuyện…'
                        : 'Cuộc trò chuyện mới',
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _searchController,
                onChanged: history.search,
                decoration: const InputDecoration(
                  hintText: 'Tìm cuộc trò chuyện…',
                  prefixIcon: Icon(
                    Icons.search,
                    color: AppColors.slate400,
                    size: 20,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(child: _buildBody(history)),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(AiChatHistoryProvider history) {
    if (history.isInitialLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (history.status == HistoryStatus.error && !history.hasConversations) {
      return _HistoryMessageState(
        icon: Icons.cloud_off_outlined,
        title: 'Không tải được lịch sử trò chuyện',
        message: history.errorMessage ?? 'Đã xảy ra lỗi khi tải dữ liệu.',
        actionLabel: 'Thử lại',
        onAction: () => history.loadConversations(forceRefresh: true),
      );
    }

    if (!history.hasConversations && history.status == HistoryStatus.loaded) {
      return const _HistoryMessageState(
        icon: Icons.chat_bubble_outline,
        title: 'Chưa có cuộc trò chuyện',
        message: 'Các cuộc trò chuyện của bạn sẽ xuất hiện tại đây.',
      );
    }

    if (!history.hasSearchResults) {
      return _HistoryMessageState(
        icon: Icons.search_off,
        title: 'Không tìm thấy cuộc trò chuyện',
        message: 'Thử tìm bằng một từ khóa khác.',
        actionLabel: 'Xóa tìm kiếm',
        onAction: () {
          _searchController.clear();
          history.search('');
        },
      );
    }

    final conversations = history.filteredConversations;

    return RefreshIndicator(
      onRefresh: _onRefresh,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount:
            conversations.length +
            (history.status == HistoryStatus.error ? 1 : 0),
        separatorBuilder: (context, index) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          if (index == 0 && history.status == HistoryStatus.error) {
            return _HistoryErrorBanner(
              message: history.errorMessage ?? 'Không thể làm mới dữ liệu.',
              onRetry: _onRefresh,
            );
          }

          final conversationIndex =
              index - (history.status == HistoryStatus.error ? 1 : 0);
          final conversation = conversations[conversationIndex];
          return _ConversationCard(
            conversation: conversation,
            isBusy: history.isConversationBusy(conversation.id),
            onTap: () => _onOpenConversation(conversation),
            onRename: () => _onRenameConversation(conversation),
            onDelete: () => _onDeleteConversation(conversation),
          );
        },
      ),
    );
  }
}

class _ConversationCard extends StatelessWidget {
  const _ConversationCard({
    required this.conversation,
    required this.isBusy,
    required this.onTap,
    required this.onRename,
    required this.onDelete,
  });

  final AiConversation conversation;
  final bool isBusy;
  final VoidCallback onTap;
  final VoidCallback onRename;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.zero,
      child: InkWell(
        onTap: isBusy ? null : onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.blueChipBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.auto_awesome_outlined,
                  color: AppColors.blueChipFg,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            conversation.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.slate900,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          conversation.timeLabel,
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.slate400,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      conversation.lastMessagePreview,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        height: 1.35,
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 4),
              if (isBusy)
                const Padding(
                  padding: EdgeInsets.all(10),
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              else
                PopupMenuButton<_ConversationMenuAction>(
                  tooltip: 'Tùy chọn cuộc trò chuyện',
                  onSelected: (action) {
                    switch (action) {
                      case _ConversationMenuAction.rename:
                        onRename();
                        break;
                      case _ConversationMenuAction.delete:
                        onDelete();
                        break;
                    }
                  },
                  itemBuilder: (context) => const [
                    PopupMenuItem(
                      value: _ConversationMenuAction.rename,
                      child: ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(Icons.edit_outlined),
                        title: Text('Đổi tên'),
                      ),
                    ),
                    PopupMenuItem(
                      value: _ConversationMenuAction.delete,
                      child: ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(Icons.delete_outline),
                        title: Text('Xóa'),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HistoryMessageState extends StatelessWidget {
  const _HistoryMessageState({
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 42, color: AppColors.slate400),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.slate900,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: AppColors.slate500),
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 16),
              OutlinedButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

class _HistoryErrorBanner extends StatelessWidget {
  const _HistoryErrorBanner({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.dangerBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              message,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, color: AppColors.danger),
            ),
          ),
          TextButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    );
  }
}

/// Owns the editing controller for the full lifetime of the dialog route.
/// The controller is disposed only after the dialog widget is actually removed,
/// not immediately when showDialog's Future completes during the reverse
/// transition animation.
class _RenameConversationDialog extends StatefulWidget {
  const _RenameConversationDialog({required this.initialTitle});

  final String initialTitle;

  @override
  State<_RenameConversationDialog> createState() =>
      _RenameConversationDialogState();
}

class _RenameConversationDialogState extends State<_RenameConversationDialog> {
  late final TextEditingController _controller;
  String? _validationMessage;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialTitle);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final value = _controller.text.trim();
    if (value.isEmpty) {
      setState(() => _validationMessage = 'Vui lòng nhập tiêu đề.');
      return;
    }

    Navigator.of(context).pop(value);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Đổi tên cuộc trò chuyện'),
      content: TextField(
        controller: _controller,
        autofocus: true,
        maxLength: 80,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(
          labelText: 'Tên cuộc trò chuyện',
          errorText: _validationMessage,
        ),
        onChanged: (_) {
          if (_validationMessage != null) {
            setState(() => _validationMessage = null);
          }
        },
        onSubmitted: (_) => _submit(),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Hủy'),
        ),
        FilledButton(onPressed: _submit, child: const Text('Lưu')),
      ],
    );
  }
}
