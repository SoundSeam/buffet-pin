#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as cloudfrontOrigins from "aws-cdk-lib/aws-cloudfront-origins";
import * as customResources from "aws-cdk-lib/custom-resources";
import * as events from "aws-cdk-lib/aws-events";
import * as eventsTargets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL(".", import.meta.url));

class BuffetPinAsyncStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const stage = this.node.tryGetContext("stage") ?? "production";
    const appUrl = this.node.tryGetContext("appUrl") ?? "https://www.buffetpin.com";
    const vercelTeam = this.node.tryGetContext("vercelTeam") ?? "sounds-soundseamcos-projects";
    const vercelProject = this.node.tryGetContext("vercelProject") ?? "buffet-pin";
    const alertEmail = this.node.tryGetContext("alertEmail") ?? "";
    const prefix = `buffet-pin-${stage}`;

    cdk.Tags.of(this).add("Application", "buffet-pin");
    cdk.Tags.of(this).add("Environment", stage);
    cdk.Tags.of(this).add("ManagedBy", "cdk");

    const mediaBucket = new s3.Bucket(this, "MediaBucket", {
      bucketName: `buffet-pin-media-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: true,
    });
    mediaBucket.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    const mediaDistribution = new cloudfront.Distribution(this, "MediaDistribution", {
      comment: "Buffet Pin public media",
      defaultBehavior: {
        origin: cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(mediaBucket),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      enableIpv6: true,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });
    mediaDistribution.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    const makeQueue = (name) => {
      const dlq = new sqs.Queue(this, `${name}Dlq`, {
        queueName: `${prefix}-${name}-dlq`,
        retentionPeriod: cdk.Duration.days(14),
        encryption: sqs.QueueEncryption.SQS_MANAGED,
      });
      const queue = new sqs.Queue(this, `${name}Queue`, {
        queueName: `${prefix}-${name}`,
        retentionPeriod: cdk.Duration.days(14),
        visibilityTimeout: cdk.Duration.minutes(6),
        encryption: sqs.QueueEncryption.SQS_MANAGED,
        deadLetterQueue: { queue: dlq, maxReceiveCount: 5 },
      });
      dlq.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
      queue.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
      return { queue, dlq };
    };

    const critical = makeQueue("critical");
    const notifications = makeQueue("notifications");
    const schedulerDlq = new sqs.Queue(this, "SchedulerDlq", {
      queueName: `${prefix}-scheduler-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });
    schedulerDlq.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    const callbackSecret = new secretsmanager.Secret(this, "CallbackSecret", {
      secretName: `${prefix}/async-callback-secret`,
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });
    const realtimeSecret = new secretsmanager.Secret(this, "RealtimeSecret", {
      secretName: `${prefix}/realtime-signing-secret`,
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });
    callbackSecret.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    realtimeSecret.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    const authorizer = new lambdaNodejs.NodejsFunction(this, "RealtimeAuthorizer", {
      functionName: `${prefix}-realtime-authorizer`,
      entry: `${directory}/lambda/authorizer.mjs`,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(10),
      memorySize: 192,
      environment: { REALTIME_SECRET_ARN: realtimeSecret.secretArn },
      bundling: { minify: true, sourceMap: true, target: "node22" },
    });
    realtimeSecret.grantRead(authorizer);
    authorizer.addPermission("AllowAppSyncInvoke", {
      principal: new iam.ServicePrincipal("appsync.amazonaws.com"),
    });

    const eventApi = new appsync.CfnApi(this, "EventApi", {
      name: `${prefix}-events`,
      ownerContact: "Buffet Pin operations",
      eventConfig: {
        authProviders: [
          { authType: "AWS_IAM" },
          {
            authType: "AWS_LAMBDA",
            lambdaAuthorizerConfig: {
              authorizerUri: authorizer.functionArn,
              authorizerResultTtlInSeconds: 60,
            },
          },
        ],
        connectionAuthModes: [{ authType: "AWS_LAMBDA" }],
        defaultPublishAuthModes: [{ authType: "AWS_IAM" }],
        defaultSubscribeAuthModes: [{ authType: "AWS_LAMBDA" }],
      },
    });
    new appsync.CfnChannelNamespace(this, "UpdatesNamespace", {
      apiId: eventApi.attrApiId,
      name: "updates",
      publishAuthModes: [{ authType: "AWS_IAM" }],
      subscribeAuthModes: [{ authType: "AWS_LAMBDA" }],
    });

    const relayEnvironment = {
      APP_URL: appUrl,
      CALLBACK_SECRET_ARN: callbackSecret.secretArn,
      APPSYNC_HTTP_URL: cdk.Fn.join("", ["https://", eventApi.attrDnsHttp, "/event"]),
    };
    const makeRelay = (name, queue, concurrency) => {
      const fn = new lambdaNodejs.NodejsFunction(this, `${name}Relay`, {
        functionName: `${prefix}-${name.toLowerCase()}-relay`,
        entry: `${directory}/lambda/relay.mjs`,
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        timeout: cdk.Duration.minutes(1),
        memorySize: 256,
        reservedConcurrentExecutions: concurrency,
        environment: relayEnvironment,
        bundling: { minify: true, sourceMap: true, target: "node22" },
      });
      callbackSecret.grantRead(fn);
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ["appsync:EventPublish"],
        resources: [cdk.Stack.of(this).formatArn({ service: "appsync", resource: "apis", resourceName: `${eventApi.attrApiId}/*` })],
      }));
      fn.addEventSource(new lambdaEventSources.SqsEventSource(queue, {
        batchSize: 1,
        reportBatchItemFailures: true,
        maxConcurrency: concurrency,
      }));
      return fn;
    };
    makeRelay("Critical", critical.queue, 2);
    makeRelay("Notification", notifications.queue, 2);

    const recovery = new lambdaNodejs.NodejsFunction(this, "Recovery", {
      functionName: `${prefix}-recovery`,
      entry: `${directory}/lambda/recovery.mjs`,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(1),
      memorySize: 192,
      reservedConcurrentExecutions: 1,
      environment: { APP_URL: appUrl, CALLBACK_SECRET_ARN: callbackSecret.secretArn },
      bundling: { minify: true, sourceMap: true, target: "node22" },
    });
    callbackSecret.grantRead(recovery);
    new events.Rule(this, "HourlyRecoveryRule", {
      ruleName: `${prefix}-hourly-recovery`,
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [new eventsTargets.LambdaFunction(recovery)],
    });

    const scheduleGroup = new scheduler.CfnScheduleGroup(this, "ScheduleGroup", {
      name: `${prefix}-deadlines`,
    });
    const schedulerRole = new iam.Role(this, "SchedulerExecutionRole", {
      roleName: `${prefix}-scheduler-execution`,
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    });
    critical.queue.grantSendMessages(schedulerRole);
    notifications.queue.grantSendMessages(schedulerRole);
    schedulerDlq.grantSendMessages(schedulerRole);

    const oidc = new iam.OpenIdConnectProvider(this, "VercelOidc", {
      url: `https://oidc.vercel.com/${vercelTeam}`,
      clientIds: [`https://vercel.com/${vercelTeam}`],
    });
    const runtimeRole = new iam.Role(this, "VercelRuntimeRole", {
      roleName: `${prefix}-vercel-runtime`,
      assumedBy: new iam.WebIdentityPrincipal(oidc.openIdConnectProviderArn, {
        StringEquals: {
          [`oidc.vercel.com/${vercelTeam}:aud`]: `https://vercel.com/${vercelTeam}`,
          [`oidc.vercel.com/${vercelTeam}:sub`]: `owner:${vercelTeam}:project:${vercelProject}:environment:${stage}`,
        },
      }),
      maxSessionDuration: cdk.Duration.hours(1),
    });
    critical.queue.grantSendMessages(runtimeRole);
    notifications.queue.grantSendMessages(runtimeRole);
    runtimeRole.addToPolicy(new iam.PolicyStatement({
      actions: ["scheduler:CreateSchedule", "scheduler:GetSchedule", "scheduler:DeleteSchedule"],
      resources: [cdk.Stack.of(this).formatArn({ service: "scheduler", resource: "schedule", resourceName: `${scheduleGroup.name}/*` })],
    }));
    runtimeRole.addToPolicy(new iam.PolicyStatement({ actions: ["iam:PassRole"], resources: [schedulerRole.roleArn] }));

    const alarmTopic = new sns.Topic(this, "AlarmTopic", {
      topicName: `${prefix}-alerts`,
      displayName: "Buffet Pin infrastructure alerts",
    });
    const budgetTopicPolicy = alarmTopic.addToResourcePolicy(new iam.PolicyStatement({
      principals: [new iam.ServicePrincipal("budgets.amazonaws.com")],
      actions: ["sns:Publish"],
      resources: [alarmTopic.topicArn],
    }));
    if (alertEmail) alarmTopic.addSubscription(new subscriptions.EmailSubscription(alertEmail));
    for (const [name, queue] of [["Critical", critical.dlq], ["Notifications", notifications.dlq], ["Scheduler", schedulerDlq]]) {
      const alarm = new cloudwatch.Alarm(this, `${name}DlqAlarm`, {
        alarmName: `${prefix}-${name.toLowerCase()}-dlq-not-empty`,
        metric: queue.metricApproximateNumberOfMessagesVisible({ period: cdk.Duration.minutes(5) }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      alarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));
    }
    const monthlyBudget = new budgets.CfnBudget(this, "MonthlyBudget", {
      budget: {
        budgetName: `${prefix}-monthly-cost`,
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: 25, unit: "USD" },
        costFilters: { TagKeyValue: ["user:Application$buffet-pin"] },
      },
    });
    const budgetArn = cdk.Stack.of(this).formatArn({
      service: "budgets",
      region: "",
      resource: "budget",
      resourceName: `${prefix}-monthly-cost`,
    });
    for (const [id, notificationType, threshold] of [
      ["ForecastBudgetAlert", "FORECASTED", 80],
      ["ActualBudgetAlert", "ACTUAL", 100],
    ]) {
      const alert = new customResources.AwsCustomResource(this, id, {
        onCreate: {
          service: "Budgets",
          action: "createNotification",
          parameters: {
            AccountId: this.account,
            BudgetName: `${prefix}-monthly-cost`,
            Notification: {
              ComparisonOperator: "GREATER_THAN",
              NotificationType: notificationType,
              Threshold: threshold,
              ThresholdType: "PERCENTAGE",
            },
            Subscribers: [{ SubscriptionType: "SNS", Address: alarmTopic.topicArn }],
          },
          physicalResourceId: customResources.PhysicalResourceId.of(`${prefix}-${notificationType.toLowerCase()}-${threshold}`),
        },
        policy: customResources.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({ actions: ["budgets:ModifyBudget", "budgets:ViewBudget"], resources: [budgetArn] }),
        ]),
      });
      alert.node.addDependency(monthlyBudget);
      alert.node.addDependency(budgetTopicPolicy.policyDependable);
    }

    new cdk.CfnOutput(this, "CriticalQueueUrl", { value: critical.queue.queueUrl });
    new cdk.CfnOutput(this, "CriticalQueueArn", { value: critical.queue.queueArn });
    new cdk.CfnOutput(this, "NotificationQueueUrl", { value: notifications.queue.queueUrl });
    new cdk.CfnOutput(this, "NotificationQueueArn", { value: notifications.queue.queueArn });
    new cdk.CfnOutput(this, "SchedulerGroupName", { value: scheduleGroup.name });
    new cdk.CfnOutput(this, "SchedulerRoleArn", { value: schedulerRole.roleArn });
    new cdk.CfnOutput(this, "SchedulerDlqArn", { value: schedulerDlq.queueArn });
    new cdk.CfnOutput(this, "VercelRuntimeRoleArn", { value: runtimeRole.roleArn });
    new cdk.CfnOutput(this, "CallbackSecretArn", { value: callbackSecret.secretArn });
    new cdk.CfnOutput(this, "RealtimeSecretArn", { value: realtimeSecret.secretArn });
    new cdk.CfnOutput(this, "AppSyncHttpUrl", { value: cdk.Fn.join("", ["https://", eventApi.attrDnsHttp, "/event"]) });
    new cdk.CfnOutput(this, "AppSyncRealtimeUrl", { value: cdk.Fn.join("", ["wss://", eventApi.attrDnsRealtime, "/event/realtime"]) });
    new cdk.CfnOutput(this, "AlarmTopicArn", { value: alarmTopic.topicArn });
    new cdk.CfnOutput(this, "MediaBucketName", { value: mediaBucket.bucketName });
    new cdk.CfnOutput(this, "MediaDistributionDomainName", { value: mediaDistribution.distributionDomainName });
    new cdk.CfnOutput(this, "MediaDistributionId", { value: mediaDistribution.distributionId });
  }
}

const app = new cdk.App();
new BuffetPinAsyncStack(app, "buffet-pin-async-production", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? "us-east-2" },
  description: "Buffet Pin durable async jobs, deadlines, and realtime invalidations",
});
