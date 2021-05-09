import { DefaultVpc, DefaultVpcProps } from '../lib/vpc/default-vpc';
//import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';
import { App, Stack, StackProps } from "@aws-cdk/core";
import { RetentionDays } from "@aws-cdk/aws-logs";


const testApp: App = new App();
const testStackProps: StackProps = { env: { region: "ap-south-1" } }
const testStack: Stack = new Stack(testApp, "TestStack", testStackProps);
const vpcSubnetMaxAzs = 2
const vpcProps: DefaultVpcProps = {
  cidr: '10.0.0.0/21',
  maxAzs: vpcSubnetMaxAzs,
  vpcFlowLogGroupName: '/vpc/flowLogs',
  dynamoDbPrefixListId: 'pl-78a54011',
  s3PrefixListId: 'pl-78a54011'
}

const vpc: DefaultVpc = new DefaultVpc(testStack, 'TestDefaultVpc', vpcProps)

describe('Validate props', () => {

  it('DMZ Subnet defaults are set', () => {
    expect(vpc.dmzSubnetName).toBe('DMZ');
    expect(vpc.dmzSubnetCidrMask).toBe(24);
  });

  it('Isolated Subnet defaults are set', () => {
    expect(vpc.isolatedSubnetName).toBe('APPLICATION');
    expect(vpc.isolatedSubnetCidrMask).toBe(24);
  })

  it('VPC flow logs will be retained for 1 week by default', () => {
    expect(vpc.vpcFlowLogRetention).toBe(RetentionDays.ONE_WEEK);
  })
});

describe('Validate stack', () => {

  it('Total subnet count check - twice number of AZs', () => {
    expect(testStack).toCountResources('AWS::EC2::Subnet', 2 * vpcSubnetMaxAzs);
  });

  it('Atleast one subnet is a DMZ', () => {
    expect(testStack).toHaveResourceLike('AWS::EC2::Subnet', {
      Tags: [
        { Key: "aws-cdk:subnet-name", Value: "DMZ" },
        { Key: "aws-cdk:subnet-type", Value: "Public" }
      ]
    });
  });

  it('A flow log will capture all VPC traffic', () => {
    expect(testStack).toHaveResource('AWS::EC2::FlowLog', { ResourceType: "VPC", TrafficType: "ALL", LogDestinationType: "cloud-watch-logs" });
  });

  it('Total security groups count check - 4', () => {
    expect(testStack).toCountResources('AWS::EC2::SecurityGroup', 4);
  });

  it('Cluster Instance Security Group Allows HTTPS traffic to VPC Endpoint Interfaces', () => {
    expect(testStack).toHaveResourceLike('AWS::EC2::SecurityGroupEgress', {
      Description: "Allow outgoing HTTPS traffic to VPC Enpoint Interfaces",
      ToPort: 443
    });
  });

});




