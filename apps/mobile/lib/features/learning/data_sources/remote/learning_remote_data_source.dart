import '../learning_content_data_source.dart';

/// Marker contract for the real Backend implementation of Learning content.
/// The shared operations are defined by [LearningContentDataSource].
abstract interface class LearningRemoteDataSource
    implements LearningContentDataSource {}
