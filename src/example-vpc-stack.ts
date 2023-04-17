import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

const privateSubnetASelection: ec2.SubnetSelection = {
//    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    subnetGroupName: 'PrivateA'
};
export class ExampleVpcStack extends cdk.Stack {

    vpc: ec2.Vpc;
    publicSubnet: ec2.ISubnet;
    privateSubnetA: ec2.ISubnet;
    privateSubnetB: ec2.ISubnet;
    vpcCidr = '10.0.0.0/16';
    publicSubnetCidr = '10.0.1.0/24';
    privateSubnetACidr = '10.0.2.0/24';
    privateSubnetBCidr = '10.0.3.0/24';

    constructor(scope: Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props);


        this.vpc = new ec2.Vpc(this, "ExampleVpc", {
            ipAddresses: ec2.IpAddresses.cidr(this.vpcCidr),
            maxAzs: 2,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'Public',
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: 'PrivateA',
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                },
                {
                    cidrMask: 24,
                    name: 'PrivateB',
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                },
            ],
        });

        this.publicSubnet = this.vpc.publicSubnets[0];
        this.privateSubnetA = this.vpc.isolatedSubnets[0];
        this.privateSubnetB = this.vpc.isolatedSubnets[1];
        // Elastic IP
        const elasticIp = new ec2.CfnEIP(this, 'NatEip', {
            domain: 'ExampleVpc',
        });
        const natGateway = new ec2.CfnNatGateway(this, 'NatGateway', {
            subnetId: this.publicSubnet.subnetId,
            allocationId: elasticIp.attrAllocationId,
        });

        const privateRoute = new ec2.CfnRoute(this, 'NatGatewayRoute', {
            routeTableId: this.privateSubnetA.routeTable.routeTableId,
            destinationCidrBlock: '0.0.0.0/0',
            natGatewayId: natGateway.ref,
        });
        this.addInterfaceEndpoints();

    }

    private addInterfaceEndpoints() {
        // We need to add the VPC endpoints for SSM in the parent region
        {
            this.vpc.addInterfaceEndpoint('ssm-messages', {
                privateDnsEnabled: true,
                service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
                subnets: this.vpc.selectSubnets(privateSubnetASelection),
            });

            this.vpc.addInterfaceEndpoint('ec2-messages', {
                privateDnsEnabled: true,
                service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
                subnets: this.vpc.selectSubnets(privateSubnetASelection),
            });

            this.vpc.addInterfaceEndpoint('ssm', {
                privateDnsEnabled: true,
                service: ec2.InterfaceVpcEndpointAwsService.SSM,
                subnets: this.vpc.selectSubnets(privateSubnetASelection),
            });
        }

        // 現状のCDKではprivateDNSをtrueとすると、Private DNSのinbound Endpointが有効になってしまう。
        // その場合gatewayエンドポイントが必要になる（らしい）。gatawayエンドポイントは作りたくないので
        // PrivateDNSをfalseとして、AWSコンソールで手動でTrueに設定する、
        this.vpc.addInterfaceEndpoint('s3', {
            privateDnsEnabled: false,
            service: ec2.InterfaceVpcEndpointAwsService.S3,
            subnets: this.vpc.selectSubnets(privateSubnetASelection),
        });
    }
}