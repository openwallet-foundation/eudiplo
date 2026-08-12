module.exports = {
    branches: ['main'],
    ci: true,
    plugins: [
        ['@semantic-release/commit-analyzer', {
            preset: 'angular',
            releaseRules: [
                { type: 'docs', scope: 'README', release: 'patch' },
                { type: 'fix', release: 'patch' },
                { type: 'feat', release: 'minor' },
                { type: 'perf', release: 'patch' },
                { type: 'refactor', release: 'patch' },
                { breaking: true, release: 'major' },
            ],
            parserOpts: {
                noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES'],
            },
        }],
        ['@semantic-release/release-notes-generator', {
            preset: 'angular',
            parserOpts: {
                noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES', 'BREAKING'],
            },
            writerOpts: {
                commitsSort: ['subject', 'scope'],
            },
        }],
        ['@semantic-release/changelog', {
            changelogFile: 'CHANGELOG.md',
            changelogTitle: '# EU Diplo Changelog',
        }],
        [
            '@semantic-release/exec',
            {
                prepareCmd: 'node scripts/sync-sdk-version.js ${nextRelease.version} && node scripts/sync-cli-version.js ${nextRelease.version}',
                publishCmd: 'chmod +x scripts/release-docker.sh && DOCKER_RELEASE_VERSION=${nextRelease.version} ./scripts/release-docker.sh',
            },
        ],
        ['@semantic-release/npm', {
            pkgRoot: 'packages/eudiplo-sdk-core',
        }],
        [
            '@semantic-release/exec',
            {
                publishCmd: 'node scripts/publish-cli.js latest',
            },
        ],
        ['@semantic-release/github', {
            assets: [
                {
                    path: 'release/eudiplo-v${nextRelease.version}-linux-x64.tar.gz',
                    label: 'eudiplo-v${nextRelease.version}-linux-x64.tar.gz',
                },
                {
                    path: 'release/eudiplo-v${nextRelease.version}-linux-arm64.tar.gz',
                    label: 'eudiplo-v${nextRelease.version}-linux-arm64.tar.gz',
                },
                {
                    path: 'release/eudiplo-v${nextRelease.version}-macos-arm64.tar.gz',
                    label: 'eudiplo-v${nextRelease.version}-macos-arm64.tar.gz',
                },
                {
                    path: 'release/eudiplo-v${nextRelease.version}-windows-x64.zip',
                    label: 'eudiplo-v${nextRelease.version}-windows-x64.zip',
                },
                {
                    path: 'release/SHA256SUMS.txt',
                    label: 'SHA256SUMS.txt',
                },
            ],
            addReleases: 'bottom',
            successComment: '🎉 This PR is included in version ${nextRelease.version}',
            failComment: '❌ semantic-release failed',
            releasedLabels: ['released'],
        }],
    ],
};