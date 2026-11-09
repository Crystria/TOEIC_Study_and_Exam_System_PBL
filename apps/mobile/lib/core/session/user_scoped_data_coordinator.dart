// ignore_for_file: prefer_initializing_formals
import 'dart:async';

import '../storage/vocabulary_progress_storage.dart';

typedef UserScopeResetCallback = void Function();
typedef UserScopeLoadCallback = Future<void> Function();

/// Coordinates in-memory state and persistent local data across account
/// changes. It never deletes another user's persisted data.
class UserScopedDataCoordinator {
  UserScopedDataCoordinator({
    required VocabularyProgressStorage vocabularyStorage,
    required List<UserScopeResetCallback> resetCallbacks,
    required List<UserScopeLoadCallback> loadCallbacks,
  }) : _vocabularyStorage = vocabularyStorage,
       _resetCallbacks = List.unmodifiable(resetCallbacks),
       _loadCallbacks = List.unmodifiable(loadCallbacks);

  final VocabularyProgressStorage _vocabularyStorage;
  final List<UserScopeResetCallback> _resetCallbacks;
  final List<UserScopeLoadCallback> _loadCallbacks;

  String? _activeUserId;
  Future<void> _transitionQueue = Future<void>.value();

  String? get activeUserId => _activeUserId;
  String? get currentUserId => _activeUserId;

  Future<void> activateUser(String userId) {
    final normalizedUserId = userId.trim();
    if (normalizedUserId.isEmpty) {
      return Future<void>.error(
        ArgumentError.value(userId, 'userId', 'User ID must not be empty.'),
      );
    }

    final completer = Completer<void>();
    _transitionQueue = _transitionQueue.then((_) async {
      try {
        if (_activeUserId == normalizedUserId) {
          completer.complete();
          return;
        }

        _resetInMemoryState();
        _vocabularyStorage.bindUser(normalizedUserId);
        _activeUserId = normalizedUserId;

        await _vocabularyStorage.prepare();
        for (final load in _loadCallbacks) {
          await load();
        }

        completer.complete();
      } catch (error, stackTrace) {
        // Fail closed even if one Provider reset callback itself throws.
        // The storage must never remain bound to an account whose activation
        // did not finish successfully.
        _activeUserId = null;
        _vocabularyStorage.unbindUser();
        try {
          _resetInMemoryState();
        } catch (_) {
          // Preserve the original activation failure for the caller.
        }
        completer.completeError(error, stackTrace);
      }
    });

    return completer.future;
  }

  /// Resets the active user's in-memory state and removes the storage scope.
  /// Persistent data remains under its user-specific key for the next login.
  Future<void> clearCurrentUser() {
    final completer = Completer<void>();
    _transitionQueue = _transitionQueue.then((_) async {
      Object? resetError;
      StackTrace? resetStackTrace;
      try {
        _resetInMemoryState();
      } catch (error, stackTrace) {
        resetError = error;
        resetStackTrace = stackTrace;
      } finally {
        // Account isolation takes priority over an individual cache reset.
        // Always unbind local persistence so future writes cannot use the
        // previous account's storage key after logout.
        _vocabularyStorage.unbindUser();
        _activeUserId = null;
      }

      if (resetError != null) {
        completer.completeError(resetError, resetStackTrace!);
      } else {
        completer.complete();
      }
    });

    return completer.future;
  }

  void _resetInMemoryState() {
    Object? firstError;
    StackTrace? firstStackTrace;

    // Attempt every reset so a failure in one cache does not leave other
    // feature state populated with the previous account's data.
    for (final reset in _resetCallbacks) {
      try {
        reset();
      } catch (error, stackTrace) {
        firstError ??= error;
        firstStackTrace ??= stackTrace;
      }
    }

    if (firstError != null) {
      Error.throwWithStackTrace(firstError, firstStackTrace!);
    }
  }
}
