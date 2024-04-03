import type { Config } from 'jest';

const config: Config = {
    verbose: true,
    preset: "ts-jest",
    testEnvironment: "node",
    coverageDirectory: "coverage",
    coverageReporters: ['text-summary', 'html'],
    randomize: true,
    roots: [
        '<rootDir>/src'
    ],
    coverageThreshold: {
        global: {
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100,
        },
    },
    reporters: [
        "default",
        ["jest-html-reporters", {
            publicPath: "./test-report",
            filename: "report.html",
            openReport: true,
            expand: false,
            pageTitle: "FsmRx Tests",
            enableMergeData: true,
            dataMergeLevel: 1
        }]
    ],
    testPathIgnorePatterns: [
        "/node_modules/",
        "\\.spec\\.ts$"
    ]
};

export default config;

