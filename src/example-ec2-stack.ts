import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import {
  aws_iam as iam,
  aws_ec2 as ec2
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

// TODO: Change these to suitable values
const REGION_AZ = 'us-west-2a';

// Amazon Linux 2022 https://docs.aws.amazon.com/linux/al2022/ug/what-is-amazon-linux.html
const al2022Ami = ec2.MachineImage.fromSsmParameter('/aws/service/ami-amazon-linux-latest/al2022-ami-kernel-default-x86_64');

// Choose an instance type that is supported in the chosen Local Zone
// https://aws.amazon.com/about-aws/global-infrastructure/localzones/features/
const instanceType = ec2.InstanceType.of(ec2.InstanceClass.COMPUTE5, ec2.InstanceSize.XLARGE2);


const isolatedSubnetsSelection: ec2.SubnetSelection = {
  subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
  availabilityZones: [REGION_AZ],
};

const userDataNatInstance = ec2.UserData.forLinux();
userDataNatInstance.addCommands(
  'sudo sysctl -w net.ipv4.ip_forward=1',
  'sudo yum -y install iptables-services',
  'sudo iptables -t nat -A POSTROUTING -o ens5 -j MASQUERADE',
  'sudo iptables-save',
);

export class ExamplePrivateEC2Stack extends Stack {
  
  // The VPC is deployed to the parent region and in the Local Zone
  get availabilityZones() {
    return [
      REGION_AZ,
    ];
  }

  constructor(scope: Construct, id: string, vpc: ec2.Vpc, props: StackProps) {
    super(scope, id, props);

    // Instance role that allows SSM to connect
    const role = new iam.Role(this, 'InstanceRoleWithSsmPolicy', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    });
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'));

    const instance = new ec2.Instance(this, 'PrivateInstance', {
      vpc: vpc,
      vpcSubnets: isolatedSubnetsSelection,
      instanceType,
      machineImage: al2022Ami,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(8, {
            encrypted: true,
            volumeType: ec2.EbsDeviceVolumeType.GP2,
          }),
        }
      ],
      role,
      userDataCausesReplacement: true,
    });

    new CfnOutput(this, 'instancePrivateIp', {
      exportName: 'instancePrivateIp',
      value: instance.instancePrivateIp,
    });
  }
}
