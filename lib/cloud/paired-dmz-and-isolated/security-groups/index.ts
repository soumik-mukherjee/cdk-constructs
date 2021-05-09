import { Construct, Tags } from "@aws-cdk/core";
import { Vpc, SecurityGroup, Port, Peer } from "@aws-cdk/aws-ec2";

export const INTERFACE_ENDPOINTS_SECURITY_GROUP_NAME: string = "Vpc/InterfaceEndpoint/SecurityGroup";
export const CLUSTER_INSTANCE_SECURITY_GROUP_NAME: string = "Vpc/ClusterInstance/SecurityGroup";
export const PUBLIC_LOAD_BALANCER_SECURITY_GROUP_NAME: string = "Vpc/PublicALB/SecurityGroup";
export const VPC_LINK_SECURITY_GROUP_NAME: string = "Vpc/VpcLink/SecurityGroup";

export interface PrimarySecurityGroupsProps {
    vpc: Vpc
    dynamoDbPrefixListId: string
    s3PrefixListId: string
}

export class PrimarySecurityGroups extends Construct {
    readonly vpc: Vpc
    readonly interfaceEndpointGroup: SecurityGroup
    readonly clusterInstanceGroup: SecurityGroup
    readonly publicLoadBalancerGroup: SecurityGroup
    readonly vpcLinkGroup: SecurityGroup
    readonly dynamoDbPrefixListId: string
    readonly s3PrefixListId: string

    constructor(scope: Construct, id: string, props: PrimarySecurityGroupsProps) {
        super(scope, id);
        this.vpc = props.vpc;
        this.dynamoDbPrefixListId = props.dynamoDbPrefixListId;
        this.s3PrefixListId = props.s3PrefixListId;

        this.interfaceEndpointGroup = new SecurityGroup(this, `InterfaceEndpointSecurityGroup`, {
            securityGroupName: INTERFACE_ENDPOINTS_SECURITY_GROUP_NAME,
            vpc: this.vpc,
            description: 'Allows HTTPS access to Interface Endpoints, from within VPC',
            allowAllOutbound: false
        });

        Tags.of(this.interfaceEndpointGroup).add('Name', INTERFACE_ENDPOINTS_SECURITY_GROUP_NAME);

        this.clusterInstanceGroup = new SecurityGroup(this, 'ClusterInstanceSecurityGroup', {
            securityGroupName: CLUSTER_INSTANCE_SECURITY_GROUP_NAME,
            vpc: this.vpc,
            description: 'Controls all netwrok access from cluster/ASG instaces',
            allowAllOutbound: false
        });

        Tags.of(this.clusterInstanceGroup).add('Name', CLUSTER_INSTANCE_SECURITY_GROUP_NAME);

        this.interfaceEndpointGroup.addIngressRule(this.clusterInstanceGroup, Port.tcp(443), 'Allow incoming HTTPS traffic from ASG Instances');
        this.clusterInstanceGroup.addEgressRule(this.interfaceEndpointGroup, Port.tcp(443), 'Allow outgoing HTTPS traffic to VPC Enpoint Interfaces');
        /*
          Egress rules for s3 & dynamo db gateway access
    
          See: https://docs.aws.amazon.com/vpc/latest/userguide/vpce-gateway.html#vpc-endpoints-security
        */

        this.clusterInstanceGroup.addEgressRule(Peer.prefixList(this.s3PrefixListId), Port.tcp(443), 'Allow outgoing HTTPS traffic to s3 Gateway Interfaces');
        this.clusterInstanceGroup.addEgressRule(Peer.prefixList(this.dynamoDbPrefixListId), Port.tcp(443), 'Allow outgoing HTTPS traffic to Dynamo DB Gateway Interfaces');

        this.publicLoadBalancerGroup = new SecurityGroup(this, 'PublicLoadBalancerSecurityGroup', {
            securityGroupName: PUBLIC_LOAD_BALANCER_SECURITY_GROUP_NAME,
            vpc: this.vpc,
            description: 'Allow HTTP access to ec2 instances for - NGINX Server, Tomcat',
            allowAllOutbound: false
        });

        Tags.of(this.publicLoadBalancerGroup).add('Name', PUBLIC_LOAD_BALANCER_SECURITY_GROUP_NAME);

        this.publicLoadBalancerGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow Internet access for IPv4 sources over HTTPS');
        this.publicLoadBalancerGroup.addIngressRule(Peer.anyIpv6(), Port.tcp(443), 'Allow Internet access for IPv6 sources over HTTPS');
        this.publicLoadBalancerGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'Allow Internet access for IPv4 sources over HTTP');
        this.publicLoadBalancerGroup.addIngressRule(Peer.anyIpv6(), Port.tcp(80), 'Allow Internet access for IPv6 sources over HTTP');


        this.publicLoadBalancerGroup.addEgressRule(this.clusterInstanceGroup, Port.allTcp(), 'Only allow outgoing to ASG instances');
        this.clusterInstanceGroup.addIngressRule(this.publicLoadBalancerGroup, Port.allTcp(), 'Only allow incoming to ASG instances from load balancer only');

        /*
        new cdk.CfnOutput(this, 'DefaultVpcLbSecurityGroupId', {

            value: DefaultVpcAppLbSecurityGroup.securityGroupId,
            description: 'The Id of the security group of the load balancer',
            exportName: 'DefaultVpcLbSecurityGroupId',
        });
        */

        this.vpcLinkGroup = new SecurityGroup(this, 'VpcLinkSecurityGroup', {
            securityGroupName: VPC_LINK_SECURITY_GROUP_NAME,
            vpc: this.vpc,
            allowAllOutbound: false,
            description: 'A security group for the API GW VPC Link',
        });

        Tags.of(this.vpcLinkGroup).add('Name', VPC_LINK_SECURITY_GROUP_NAME);

        this.vpcLinkGroup.addEgressRule(this.clusterInstanceGroup, Port.allTcp(), 'Only allow outgoing to ASG instances');
        this.clusterInstanceGroup.addIngressRule(
            this.vpcLinkGroup,
            Port.allTcp(),
            'Allow access from Api Gw to EC2 instances, through VPC Link'
        );
    }
}