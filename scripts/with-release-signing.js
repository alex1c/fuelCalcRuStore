const { withAppBuildGradle, withSettingsGradle } = require('@expo/config-plugins')

const RELEASE_PROPERTIES_DECLARATION = `
def releaseKeystorePropertiesFile = rootProject.file('../credentials/keystore.properties')
def releaseKeystoreProperties = new Properties()
if (releaseKeystorePropertiesFile.exists()) {
    releaseKeystoreProperties.load(new FileInputStream(releaseKeystorePropertiesFile))
}
`

/**
 * Keeps production signing reproducible across Expo prebuilds.
 * Release tasks fail closed when local credentials are absent; debug builds keep
 * Expo's generated debug signing configuration.
 */
module.exports = function withReleaseSigning(config) {
  config = withSettingsGradle(config, (settingsConfig) => {
    if (settingsConfig.modResults.language !== 'groovy') {
      throw new Error('Auto Journal release hardening requires Groovy settings.gradle')
    }

    let source = settingsConfig.modResults.contents
    if (!source.includes('autoJournalProductionExclude')) {
      const marker = 'expoAutolinking.useExpoModules()'
      if (!source.includes(marker)) {
        throw new Error('Could not locate Expo autolinking settings')
      }
      source = source.replace(
        marker,
        `def autoJournalProductionExclude = [
  'expo-dev-client',
  'expo-dev-launcher',
  'expo-dev-menu',
  'expo-dev-menu-interface'
]
expoAutolinking.exclude = autoJournalProductionExclude
${marker}`,
      )
      settingsConfig.modResults.contents = source
    }
    return settingsConfig
  })

  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error('Auto Journal release signing requires Groovy build.gradle')
    }

    let source = gradleConfig.modResults.contents
    if (source.includes('releaseKeystorePropertiesFile')) {
      return gradleConfig
    }

    source = source.replace(
      'android {',
      `${RELEASE_PROPERTIES_DECLARATION}\nandroid {`,
    )

    const debugSigningConfig = /(signingConfigs\s*\{[\s\S]*?debug\s*\{[\s\S]*?\n\s*\})\n\s*\}/
    if (!debugSigningConfig.test(source)) {
      throw new Error('Could not locate generated Android debug signing config')
    }
    source = source.replace(
      debugSigningConfig,
      `$1
        if (releaseKeystorePropertiesFile.exists()) {
            release {
                storeFile file(releaseKeystoreProperties['storeFile'])
                storePassword releaseKeystoreProperties['storePassword']
                keyAlias releaseKeystoreProperties['keyAlias']
                keyPassword releaseKeystoreProperties['keyPassword']
            }
        }
    }`,
    )

    const generatedDebugReleaseSigning = /(\n\s*release\s*\{\s*\n(?:\s*\/\/[^\n]*\n)*)\s*signingConfig signingConfigs\.debug/
    if (!generatedDebugReleaseSigning.test(source)) {
      throw new Error('Could not locate generated Android release build type')
    }
    source = source.replace(
      generatedDebugReleaseSigning,
      `$1            if (releaseKeystorePropertiesFile.exists()) {
                signingConfig signingConfigs.release
            }`,
    )

    source += `

gradle.taskGraph.whenReady { graph ->
    def requestsRelease = graph.allTasks.any { task ->
        task.project == project && ['bundleRelease', 'assembleRelease', 'packageRelease'].contains(task.name)
    }
    if (requestsRelease && !releaseKeystorePropertiesFile.exists()) {
        throw new GradleException('Production keystore properties missing: credentials/keystore.properties')
    }
}
`

    gradleConfig.modResults.contents = source
    return gradleConfig
  })
}
