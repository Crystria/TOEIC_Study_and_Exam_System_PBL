import 'package:flutter/foundation.dart' show kReleaseMode;
import 'package:flutter/widgets.dart' show WidgetsFlutterBinding;

import 'core/di/app_bootstrap.dart';
import 'core/di/app_dependencies.dart';
import 'core/di/app_feature_dependencies.dart';
import 'core/di/production_feature_dependencies.dart';

/// The default entry point keeps the usual Development workflow. In AOT
/// Release builds kReleaseMode is a compile-time constant, so the Development
/// composition branch is removed by tree shaking and only API dependencies
/// remain reachable. The dedicated main_release.dart target is preferred for
/// release builds because its import graph is independently validated.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final appDependencies = AppDependencies.fromEnvironment();

  if (kReleaseMode) {
    appDependencies.config.validateForRelease();
    await startToeicApp(
      appDependencies: appDependencies,
      createFeatureGraph: ProductionFeatureDependencies.create,
    );
    return;
  }

  await startToeicApp(
    appDependencies: appDependencies,
    createFeatureGraph: AppFeatureDependencies.create,
  );
}
