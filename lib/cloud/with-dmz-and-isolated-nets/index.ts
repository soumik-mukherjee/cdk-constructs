import { Construct, CfnOutput } from "@aws-cdk/core";
import { Vpc, SubnetType, FlowLogDestination } from "@aws-cdk/aws-ec2";
import { LogGroup, RetentionDays } from "@aws-cdk/aws-logs";
import { PrimarySecurityGroups } from "./security-groups"

export * from "./security-groups";

export interface CloudCompositeProps {
    cidr: string;
    maxAzs: number;
    dmzSubnetName?: string;
    dmzSubnetCidrMask?: number;
    isolatedSubnetName?: string;
    isolatedSubnetCidrMask?: number;
    vpcFlowLogGroupName: string;
    vpcFlowLogRetention?: RetentionDays;
    dynamoDbPrefixListId: string;
    s3PrefixListId: string;
}

export class CloudComposite extends Construct {
    readonly vpc: Vpc
    readonly cidr: string
    readonly maxAzs: number
    readonly dmzSubnetName: string
    readonly isolatedSubnetName: string
    readonly dmzSubnetCidrMask: number
    readonly isolatedSubnetCidrMask: number
    readonly vpcFlowLogGroupName: string
    readonly vpcFlowLogRetention: RetentionDays
    readonly dynamoDbPrefixListId: string
    readonly s3PrefixListId: string
    readonly securityGroups: PrimarySecurityGroups

    constructor(scope: Construct, id: string, props: CloudCompositeProps) {
        super(scope, id);

        this.cidr = props.cidr
        this.maxAzs = props.maxAzs

        // Assign default values to optional props
        this.dmzSubnetName = (!props.dmzSubnetName ? 'DMZ' : props.dmzSubnetName)
        this.isolatedSubnetName = (!props.isolatedSubnetName ? 'APPLICATION' : props.isolatedSubnetName)
        this.dmzSubnetCidrMask = (!props.dmzSubnetCidrMask ? 24 : props.dmzSubnetCidrMask)
        this.isolatedSubnetCidrMask = (!props.isolatedSubnetCidrMask ? 24 : props.isolatedSubnetCidrMask)
        this.vpcFlowLogRetention = (!props.vpcFlowLogRetention ? RetentionDays.ONE_WEEK : props.vpcFlowLogRetention)

        this.vpcFlowLogGroupName = props.vpcFlowLogGroupName
        this.dynamoDbPrefixListId = props.dynamoDbPrefixListId
        this.s3PrefixListId = props.s3PrefixListId

        this.vpc = new Vpc(this, `Vpc`, {
            cidr: this.cidr,
            maxAzs: this.maxAzs,
            natGateways: 0,
            subnetConfiguration: [
                {
                    subnetType: SubnetType.ISOLATED,
                    name: this.isolatedSubnetName,
                    cidrMask: props.isolatedSubnetCidrMask,
                },
                {
                    subnetType: SubnetType.PUBLIC,
                    name: this.dmzSubnetName,
                    cidrMask: this.dmzSubnetCidrMask,
                },
            ]
        });

        const vpcFlowLogGroup = new LogGroup(this, `VpcFlowLogGroup`, {
            logGroupName: this.vpcFlowLogGroupName,
            retention: this.vpcFlowLogRetention
        });

        this.vpc.addFlowLog(id, {
            destination: FlowLogDestination.toCloudWatchLogs(vpcFlowLogGroup)
        });

        new CfnOutput(this, `vpcId`, {
            value: this.vpc.vpcId,
            description: 'The Id of the VPC',
            exportName: `vpcId`,
        });

        this.securityGroups = new PrimarySecurityGroups(this, `PrimarySecurityGroups`, { vpc: this.vpc, dynamoDbPrefixListId: this.dynamoDbPrefixListId, s3PrefixListId: this.s3PrefixListId });

    }
}