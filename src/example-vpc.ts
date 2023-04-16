import {
  Stack, 
  StackProps,
  aws_ec2 as ec2
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

// TODO: Change these to suitable values
const REGION_AZ = 'us-west-2a';

const VPC_CIDR = '172.31.100.0/24';
const SUBNET_SIZE = 26;

const isolatedSubnetsSelection: ec2.SubnetSelection = {
  subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
  availabilityZones: [REGION_AZ],
};

export class ExampleVpcStack extends Stack {

  // The VPC is deployed to the parent region and in the Local Zone
  get availabilityZones() {
    return [
      REGION_AZ,
    ];
  }

  vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(VPC_CIDR),
      subnetConfiguration: [
        {
          cidrMask: SUBNET_SIZE,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: SUBNET_SIZE,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }
      ]
    });

    // We need to add the VPC endpoints for SSM in the parent region
    this.vpc.addInterfaceEndpoint('ssm-messages', {
      privateDnsEnabled: true,
      service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
      subnets: this.vpc.selectSubnets(isolatedSubnetsSelection),
    });

    this.vpc.addInterfaceEndpoint('ec2-messages', {
      privateDnsEnabled: true,
      service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
      subnets: this.vpc.selectSubnets(isolatedSubnetsSelection),
    });

    this.vpc.addInterfaceEndpoint('ssm', {
      privateDnsEnabled: true,
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
      subnets: this.vpc.selectSubnets(isolatedSubnetsSelection),
    });

    // 現状のCDKではprivateDNSをtrueとすると、Private DNSのinbound Endpointが有効になってしまう。
    // その場合gatewayエンドポイントが必要になる（らしい）。gatawayエンドポイントは作りたくないので
    // PrivateDNSをfalseとして、AWSコンソールで手動でTrueに設定する、
    this.vpc.addInterfaceEndpoint('s3', {
      privateDnsEnabled: false,
      service: ec2.InterfaceVpcEndpointAwsService.S3,
      subnets: this.vpc.selectSubnets(isolatedSubnetsSelection),
    });

  }
}
