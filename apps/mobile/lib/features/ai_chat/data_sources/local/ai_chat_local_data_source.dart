/// Persists AI Chat runtime data for a specific user scope.
///
/// The payload is a versioned JSON-compatible snapshot produced by the
/// feature's storage mapper. The data source does not interpret UI models.
abstract interface class AiChatLocalDataSource {
  Future<Map<String, Object?>?> readSnapshot(String userId);
  Future<void> writeSnapshot(String userId, Map<String, Object?> snapshot);
}
