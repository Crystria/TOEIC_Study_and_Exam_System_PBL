import 'package:flutter/widgets.dart' show WidgetsFlutterBinding;

import 'core/di/app_bootstrap.dart';
import 'core/di/app_dependencies.dart';
import 'core/di/production_feature_dependencies.dart';

/// Production-only entry point. Test Data implementations are not imported by
/// this target; invalid APP_ENV/API configuration fails before runApp().
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final appDependencies = AppDependencies.fromEnvironment();
  appDependencies.config.validateForRelease();

  await startToeicApp(
    appDependencies: appDependencies,
    createFeatureGraph: ProductionFeatureDependencies.create,
  );
}
