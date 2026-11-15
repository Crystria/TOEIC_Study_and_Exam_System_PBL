import '../learning_content_data_source.dart';
import '../learning_session_data_source.dart';

/// Contract for the real Backend Learning adapter.
///
/// Includes content/progress operations and the Backend Vocabulary Session
/// capability. Test Data content adapters do not implement this interface.
abstract interface class LearningRemoteDataSource
    implements LearningContentDataSource, LearningSessionDataSource {}
