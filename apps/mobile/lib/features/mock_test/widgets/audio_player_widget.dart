import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../../../core/utils/media_url_resolver.dart';
import '../../../theme/app_colors.dart';

class AudioPlayerWidget extends StatefulWidget {
  const AudioPlayerWidget({super.key, required this.sourceUrl});

  final String? sourceUrl;

  @override
  State<AudioPlayerWidget> createState() => _AudioPlayerWidgetState();
}

class _AudioPlayerWidgetState extends State<AudioPlayerWidget> {
  late final AudioPlayer _player;
  late final StreamSubscription<PlayerException> _errorSubscription;

  String? _loadedUrl;
  String? _errorMessage;

  bool _isLoading = false;
  int _sourceGeneration = 0;

  @override
  void initState() {
    super.initState();

    _player = AudioPlayer();

    _errorSubscription = _player.errorStream.listen((_) {
      _showPlaybackError(_sourceGeneration);
    });
  }

  @override
  void didUpdateWidget(covariant AudioPlayerWidget oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.sourceUrl != widget.sourceUrl) {
      final generation = ++_sourceGeneration;

      _loadedUrl = null;
      _errorMessage = null;
      _isLoading = true;

      unawaited(_resetPlayer(generation));
    }
  }

  Future<void> _resetPlayer(int generation) async {
    try {
      await _player.stop();
    } catch (_) {
      // Ignore errors while releasing the previous audio source.
    }

    if (!mounted || generation != _sourceGeneration) {
      return;
    }

    setState(() {
      _isLoading = false;
    });
  }

  void _showPlaybackError(int generation) {
    if (!mounted || generation != _sourceGeneration) {
      return;
    }

    setState(() {
      _isLoading = false;
      _errorMessage =
          'Không thể phát audio. Hãy kiểm tra kết nối hoặc thử lại.';
    });
  }

  Future<void> _togglePlayback() async {
    if (_isLoading) {
      return;
    }

    // Pause nếu audio đang phát.
    if (_player.playing) {
      try {
        await _player.pause();
      } catch (_) {
        _showPlaybackError(_sourceGeneration);
      }
      return;
    }

    final rawUrl = widget.sourceUrl?.trim();

    if (rawUrl == null || rawUrl.isEmpty) {
      return;
    }

    final generation = _sourceGeneration;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final resolvedUrl = MediaUrlResolver.resolve(rawUrl);

      // Chỉ tải lại khi URL thay đổi hoặc chưa được tải.
      if (_loadedUrl != resolvedUrl) {
        await _player.setUrl(resolvedUrl);

        if (!mounted || generation != _sourceGeneration) {
          return;
        }

        _loadedUrl = resolvedUrl;
      }

      // Nếu audio đã phát hết, đưa vị trí phát về đầu.
      if (_player.processingState == ProcessingState.completed) {
        await _player.seek(Duration.zero);
      }

      if (!mounted || generation != _sourceGeneration) {
        return;
      }

      setState(() {
        _isLoading = false;
      });

      // Không chờ Future này trong callback UI vì nó chỉ hoàn tất
      // khi audio kết thúc hoặc được tạm dừng.
      unawaited(_startPlayback(generation));
    } catch (_) {
      _showPlaybackError(generation);
    }
  }

  Future<void> _startPlayback(int generation) async {
    try {
      await _player.play();
    } catch (_) {
      _showPlaybackError(generation);
    }
  }

  String _getStatusText(PlayerState state, bool hasSource) {
    if (!hasSource) {
      return 'Chưa có tệp audio cho câu hỏi này.';
    }

    if (_errorMessage != null) {
      return 'Không thể phát audio.';
    }

    if (_isLoading ||
        state.processingState == ProcessingState.loading ||
        state.processingState == ProcessingState.buffering) {
      return 'Đang tải audio...';
    }

    if (state.playing) {
      return 'Đang phát audio...';
    }

    if (state.processingState == ProcessingState.completed) {
      return 'Đã phát xong. Nhấn Phát để nghe lại.';
    }

    if (_loadedUrl != null) {
      return 'Audio đã tạm dừng. Nhấn Phát để tiếp tục.';
    }

    return 'Nhấn Phát để nghe audio.';
  }

  @override
  void dispose() {
    _sourceGeneration++;

    unawaited(_errorSubscription.cancel());
    unawaited(_player.dispose());

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasSource = widget.sourceUrl?.trim().isNotEmpty == true;

    return StreamBuilder<PlayerState>(
      stream: _player.playerStateStream,
      initialData: _player.playerState,
      builder: (context, snapshot) {
        final state = snapshot.data ?? _player.playerState;
        final isPlaying = state.playing;

        final isBusy =
            _isLoading ||
            state.processingState == ProcessingState.loading ||
            state.processingState == ProcessingState.buffering;

        return Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            SizedBox(
              width: 44,
              height: 44,
              child: isBusy
                  ? const Padding(
                      padding: EdgeInsets.all(10),
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          AppColors.purpleChipFg,
                        ),
                      ),
                    )
                  : IconButton(
                      tooltip: isPlaying ? 'Tạm dừng' : 'Phát',
                      onPressed: hasSource ? _togglePlayback : null,
                      icon: Icon(
                        isPlaying
                            ? Icons.pause_circle_filled
                            : Icons.play_circle_fill,
                        size: 32,
                      ),
                      color: AppColors.purpleChipFg,
                      disabledColor: AppColors.slate400,
                      padding: EdgeInsets.zero,
                    ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _getStatusText(state, hasSource),
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.slate500,
                    ),
                  ),
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      _errorMessage!,
                      style: TextStyle(
                        fontSize: 11,
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
