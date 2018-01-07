#![allow(non_snake_case)]
#![allow(non_camel_case_types)]
#![allow(non_shorthand_field_patterns)]
#![allow(unused_variables)]
extern crate timely;
#[macro_use]
extern crate abomonation;
extern crate differential_dataflow;
extern crate num;

use num::bigint::BigUint;
use abomonation::Abomonation;

#[macro_use] 
extern crate serde_derive;
extern crate serde;
extern crate serde_json;
use std::ops::*;
use serde::ser::*;
use serde::de::*;
use std::str::FromStr;
use serde::de::Error;
use std::collections::HashSet;
use std::collections::HashMap;
use std::io::{stdin, stdout, Write};
use std::cell::RefCell;
use std::rc::Rc;
use std::hash::Hash;
use std::fmt::Debug;
use serde_json as json;

use timely::progress::nested::product::Product;
use timely::dataflow::*;
use timely::dataflow::scopes::Child;
use timely::dataflow::operators::*;
use timely::dataflow::operators::feedback::Handle;

use differential_dataflow::input::Input;
use differential_dataflow::{Data, Collection, Hashable};
use differential_dataflow::operators::*;
use differential_dataflow::lattice::Lattice;

/// A collection defined by multiple mutually recursive rules.
///
/// A `Variable` names a collection that may be used in mutually recursive rules. This implementation
/// is like the `Variable` defined in `iterate.rs` optimized for Datalog rules: it supports repeated
/// addition of collections, and a final `distinct` operator applied before connecting the definition.
pub struct Variable<'a, G: Scope, D: Default+Data+Hashable>
where G::Timestamp: Lattice+Ord {
    feedback: Option<Handle<G::Timestamp, u64,(D, Product<G::Timestamp, u64>, isize)>>,
    current: Collection<Child<'a, G, u64>, D>,
    cycle: Collection<Child<'a, G, u64>, D>,
}

impl<'a, G: Scope, D: Default+Data+Hashable> Variable<'a, G, D> where G::Timestamp: Lattice+Ord {
    /// Creates a new `Variable` from a supplied `source` stream.
    pub fn from(source: &Collection<Child<'a, G, u64>, D>) -> Variable<'a, G, D> {
        let (feedback, cycle) = source.inner.scope().loop_variable(u64::max_value(), 1);
        let cycle = Collection::new(cycle);
        let mut result = Variable { feedback: Some(feedback), current: cycle.clone(), cycle: cycle };
        result.add(source);
        result
    }
    /// Adds a new source of data to the `Variable`.
    pub fn add(&mut self, source: &Collection<Child<'a, G, u64>, D>) {
        self.current = self.current.concat(source);
    }
}

impl<'a, G: Scope, D: Default+Data+Hashable> ::std::ops::Deref for Variable<'a, G, D> where G::Timestamp: Lattice+Ord {
    type Target = Collection<Child<'a, G, u64>, D>;
    fn deref(&self) -> &Self::Target {
        &self.cycle
    }
}

impl<'a, G: Scope, D: Default+Data+Hashable> Drop for Variable<'a, G, D> where G::Timestamp: Lattice+Ord {
    fn drop(&mut self) {
        if let Some(feedback) = self.feedback.take() {
            self.current.distinct()
                        .inner
                        .connect_loop(feedback);
        }
    }
}

#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash)]
struct Uint{x:BigUint}

impl Default for Uint {
    fn default() -> Uint {Uint{x: BigUint::default()}}
}
unsafe_abomonate!(Uint);

impl Serialize for Uint {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
        where S: Serializer
    {
        serializer.serialize_str(&self.x.to_str_radix(10))
    }
}

impl<'de> Deserialize<'de> for Uint {
    fn deserialize<D>(deserializer: D) -> Result<Uint, D::Error>
        where D: Deserializer<'de>
    {
        match String::deserialize(deserializer) {
            Ok(s) => match BigUint::from_str(&s) {
                        Ok(i)  => Ok(Uint{x:i}),
                        Err(_) => Err(D::Error::custom(format!("invalid integer value: {}", s)))
                     },
            Err(e) => Err(e)
        }
    }
}

impl Uint {
    #[inline]
    pub fn parse_bytes(buf: &[u8], radix: u32) -> Uint {
        Uint{x: BigUint::parse_bytes(buf, radix).unwrap()}
    }
}

impl Shr<usize> for Uint {
    type Output = Uint;

    #[inline]
    fn shr(self, rhs: usize) -> Uint {
        Uint{x: self.x.shr(rhs)}
    }
}

impl Shl<usize> for Uint {
    type Output = Uint;

    #[inline]
    fn shl(self, rhs: usize) -> Uint {
        Uint{x: self.x.shl(rhs)}
    }
}

macro_rules! forward_binop {
    (impl $imp:ident for $res:ty, $method:ident) => {
        impl $imp<$res> for $res {
            type Output = $res;

            #[inline]
            fn $method(self, other: $res) -> $res {
                // forward to val-ref
                Uint{x: $imp::$method(self.x, other.x)}
            }
        }
    }
}

forward_binop!(impl Add for Uint, add);
forward_binop!(impl Sub for Uint, sub);
forward_binop!(impl Div for Uint, div);
forward_binop!(impl Rem for Uint, rem);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum __lambda {
    __Lambda {__lambda_string: String}
}
impl Default for __lambda {
    fn default() ->  __lambda {
        __lambda::__Lambda{__lambda_string: Default::default()}}
}
unsafe_abomonate!(__lambda);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum lswitch_type_t {
    LSwitchRegular,
    LSwitchBridged
}
impl Default for lswitch_type_t {
    fn default() ->  lswitch_type_t {
        lswitch_type_t::LSwitchRegular}
}
unsafe_abomonate!(lswitch_type_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum ip4_subnet_t {
    IP4Subnet {addr: u32, mask: u32}
}
impl Default for ip4_subnet_t {
    fn default() ->  ip4_subnet_t {
        ip4_subnet_t::IP4Subnet{addr: Default::default(), mask: Default::default()}}
}
unsafe_abomonate!(ip4_subnet_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum ip6_subnet_t {
    IP6Subnet {addr: Uint, mask: Uint}
}
impl Default for ip6_subnet_t {
    fn default() ->  ip6_subnet_t {
        ip6_subnet_t::IP6Subnet{addr: Default::default(), mask: Default::default()}}
}
unsafe_abomonate!(ip6_subnet_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum ip_subnet_t {
    IPSubnet4 {ip4_subnet: ip4_subnet_t},
    IPSubnet6 {ip6_subnet: ip6_subnet_t}
}
impl Default for ip_subnet_t {
    fn default() ->  ip_subnet_t {
        ip_subnet_t::IPSubnet4{ip4_subnet: Default::default()}}
}
unsafe_abomonate!(ip_subnet_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum opt_subnet_t {
    SomeSubnet {subnet: ip_subnet_t},
    NoSubnet
}
impl Default for opt_subnet_t {
    fn default() ->  opt_subnet_t {
        opt_subnet_t::SomeSubnet{subnet: Default::default()}}
}
unsafe_abomonate!(opt_subnet_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum lrouter_type_t {
    RouterRegular,
    RouterGateway {chassis: u32}
}
impl Default for lrouter_type_t {
    fn default() ->  lrouter_type_t {
        lrouter_type_t::RouterRegular}
}
unsafe_abomonate!(lrouter_type_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum lrouter_port_type_t {
    LRPRegular,
    LRPGateway {redirectChassis: u32}
}
impl Default for lrouter_port_type_t {
    fn default() ->  lrouter_port_type_t {
        lrouter_port_type_t::LRPRegular}
}
unsafe_abomonate!(lrouter_port_type_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum opt_peer_t {
    NoPeer,
    SomePeer {peer: u32}
}
impl Default for opt_peer_t {
    fn default() ->  opt_peer_t {
        opt_peer_t::NoPeer}
}
unsafe_abomonate!(opt_peer_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum dhcp4_options_t {
    DHCP4Options {cidr: ip4_subnet_t, server_id: u32, server_mac: u64, router: u32, lease_time: u32}
}
impl Default for dhcp4_options_t {
    fn default() ->  dhcp4_options_t {
        dhcp4_options_t::DHCP4Options{cidr: Default::default(), server_id: Default::default(), server_mac: Default::default(), router: Default::default(), lease_time: Default::default()}}
}
unsafe_abomonate!(dhcp4_options_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum duid_t {
    DUID_LLT {hw_type: u16, time: u32, mac: u64},
    DUID_EN {iana_num: u32, id: Uint},
    DUID_LL {hw_type: u16, mac: u64},
    DUID_UUID {uuid: Uint}
}
impl Default for duid_t {
    fn default() ->  duid_t {
        duid_t::DUID_LLT{hw_type: Default::default(), time: Default::default(), mac: Default::default()}}
}
unsafe_abomonate!(duid_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum dhcp6_options_t {
    DHCP6Options {cidr: ip4_subnet_t, server_id: duid_t}
}
impl Default for dhcp6_options_t {
    fn default() ->  dhcp6_options_t {
        dhcp6_options_t::DHCP6Options{cidr: Default::default(), server_id: Default::default()}}
}
unsafe_abomonate!(dhcp6_options_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum lport_type_t {
    LPortVM,
    LPortVIF {parent: u64, tag_request: u16, tag: u16},
    LPortRouter {rport: u32},
    LPortLocalnet {localnet: u64},
    LPortL2Gateway {pnet: u64, chassis: u32}
}
impl Default for lport_type_t {
    fn default() ->  lport_type_t {
        lport_type_t::LPortVM}
}
unsafe_abomonate!(lport_type_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum opt_dhcp4_options_id_t {
    NoDHCP4Options,
    SomeDHCP4Options {options: u64}
}
impl Default for opt_dhcp4_options_id_t {
    fn default() ->  opt_dhcp4_options_id_t {
        opt_dhcp4_options_id_t::NoDHCP4Options}
}
unsafe_abomonate!(opt_dhcp4_options_id_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum opt_dhcp6_options_id_t {
    NoDHCP6Options,
    SomeDHCP6Options {options: u64}
}
impl Default for opt_dhcp6_options_id_t {
    fn default() ->  opt_dhcp6_options_id_t {
        opt_dhcp6_options_id_t::NoDHCP6Options}
}
unsafe_abomonate!(opt_dhcp6_options_id_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum ip_addr_t {
    IPAddr4 {addr4: u32},
    IPAddr6 {addr6: Uint}
}
impl Default for ip_addr_t {
    fn default() ->  ip_addr_t {
        ip_addr_t::IPAddr4{addr4: Default::default()}}
}
unsafe_abomonate!(ip_addr_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum opt_ip_addr_t {
    SomeIPAddr {addr: ip_addr_t},
    NoIPAddr
}
impl Default for opt_ip_addr_t {
    fn default() ->  opt_ip_addr_t {
        opt_ip_addr_t::SomeIPAddr{addr: Default::default()}}
}
unsafe_abomonate!(opt_ip_addr_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum ip4_addr_port_t {
    IP4AddrPort {addr: u32, prt: u16}
}
impl Default for ip4_addr_port_t {
    fn default() ->  ip4_addr_port_t {
        ip4_addr_port_t::IP4AddrPort{addr: Default::default(), prt: Default::default()}}
}
unsafe_abomonate!(ip4_addr_port_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum acl_dir_t {
    ACLTo,
    ACLFrom
}
impl Default for acl_dir_t {
    fn default() ->  acl_dir_t {
        acl_dir_t::ACLTo}
}
unsafe_abomonate!(acl_dir_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum acl_action_t {
    ACLAllow,
    ACLAllowRelated,
    ACLDrop,
    ACLReject
}
impl Default for acl_action_t {
    fn default() ->  acl_action_t {
        acl_action_t::ACLAllow}
}
unsafe_abomonate!(acl_action_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum nat_type_t {
    SNAT,
    DNAT,
    DNAT_SNAT
}
impl Default for nat_type_t {
    fn default() ->  nat_type_t {
        nat_type_t::SNAT}
}
unsafe_abomonate!(nat_type_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum opt_mac_addr_t {
    SomeMACAddr {addr: u64},
    NoMACAddr
}
impl Default for opt_mac_addr_t {
    fn default() ->  opt_mac_addr_t {
        opt_mac_addr_t::SomeMACAddr{addr: Default::default()}}
}
unsafe_abomonate!(opt_mac_addr_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum opt_lport_id_t {
    SomeLPortId {id: u64},
    NoLPortId
}
impl Default for opt_lport_id_t {
    fn default() ->  opt_lport_id_t {
        opt_lport_id_t::SomeLPortId{id: Default::default()}}
}
unsafe_abomonate!(opt_lport_id_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum port_sec_type_t {
    PortSecNone,
    PortSecMAC,
    PortSecIP
}
impl Default for port_sec_type_t {
    fn default() ->  port_sec_type_t {
        port_sec_type_t::PortSecNone}
}
unsafe_abomonate!(port_sec_type_t);
#[derive(Eq, PartialOrd, PartialEq, Ord, Debug, Clone, Hash, Serialize, Deserialize)]
enum destination_t {
    DSTChassis {chassis: u32},
    DSTLocal
}
impl Default for destination_t {
    fn default() ->  destination_t {
        destination_t::DSTChassis{chassis: Default::default()}}
}
unsafe_abomonate!(destination_t);
#[derive(Eq, Hash, PartialEq, Serialize, Deserialize, Debug)]
enum Fact {
    LogicalSwitch(u64, lswitch_type_t, String, opt_subnet_t),
    Chassis(u32, bool, String, String),
    LogicalRouter(u64, bool, String, lrouter_type_t),
    LogicalRouterPort(u32, String, u64, lrouter_port_type_t, u64, bool, opt_peer_t, u16),
    DHCPv4Options(u64, dhcp4_options_t),
    DHCPv6Options(u64, Uint, dhcp6_options_t),
    PhysicalNetwork(u64, String),
    LogicalSwitchPort(u64, u64, lport_type_t, String, bool, opt_dhcp4_options_id_t, opt_dhcp6_options_id_t, bool, u16),
    LogicalSwitchPortMAC(u64, u64),
    LogicalSwitchPortIP(u64, u64, ip_addr_t),
    LogicalSwitchPortDynAddr(u64, u64, u64, opt_ip_addr_t),
    VSwitchPort(u64, String, u32, u16),
    LPortBinding(u64, u64),
    PortSecurityMAC(u64, u64),
    PortSecurityIP(u64, u64, ip_subnet_t),
    AddressSet(u64, String),
    AddressSetAddr(u64, ip_subnet_t),
    LoadBalancer(u64, String, u8),
    LBSwitch(u64, u64),
    LBVIP(u64, ip4_addr_port_t),
    LBIP(u64, ip4_addr_port_t, ip4_addr_port_t),
    ACL(u64, u16, acl_dir_t, __lambda, acl_action_t),
    LBRouter(u64, u64),
    LRouterPortNetwork(u32, ip_subnet_t),
    LogicalRouterStaticRoute(u64, ip_subnet_t, ip_addr_t, u32),
    NAT(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, opt_lport_id_t),
    LearnedAddress(u32, ip_addr_t, u64),
    TunnelPort(u64, u16, u32, u32),
    TrunkPort(u64),
    PortSecurityEnabled(u64),
    PortIPSecurityEnabled(u64),
    PortSecurityType(u64, port_sec_type_t),
    PortSecurityIP4Match(u64, u64, ip4_subnet_t),
    PortSecurityIP6Match(u64, u64, ip6_subnet_t),
    LPortStatefulACL(u64),
    LPortLBVIP(u64, ip4_addr_port_t),
    LPortLBVIPIP(u64, u8, ip4_addr_port_t, ip4_addr_port_t),
    LPortLB(u64),
    LPortMACIP(u64, u64, u64, ip_addr_t),
    LPortDHCP4AddrOpts(u64, u64, u32, dhcp4_options_t),
    LPortDHCP6AddrOpts(u64, u64, Uint, Uint, dhcp6_options_t),
    LPortAtChassis(u64, u64, u32, bool),
    LPortMACChassis(u64, u64, u64, u32, bool),
    LPortUnknownMACChassis(u64, u64, u32, bool),
    LSwitchAtChassis(u32, u64, destination_t),
    MACChassis(u64, u64, destination_t),
    UnknownMACChassis(u32, u64, destination_t),
    TunnelFromTo(u32, u32, u32),
    LRouterNetwork(u64, ip_subnet_t),
    LRouterLBVIP(u64, u32),
    NATChassis(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, u64, u32),
    Route(u64, ip_subnet_t, opt_ip_addr_t, u32, u64, ip_addr_t),
    _realized_VSwitchPort(u64, String, u32, u16),
    _delta_VSwitchPort(bool, u64, String, u32, u16),
    _realized_LPortBinding(u64, u64),
    _delta_LPortBinding(bool, u64, u64),
    _realized_LogicalSwitchPort(u64, u64, lport_type_t, String, bool, opt_dhcp4_options_id_t, opt_dhcp6_options_id_t, bool, u16),
    _delta_LogicalSwitchPort(bool, u64, u64, lport_type_t, String, bool, opt_dhcp4_options_id_t, opt_dhcp6_options_id_t, bool, u16),
    _realized_PortSecurityType(u64, port_sec_type_t),
    _delta_PortSecurityType(bool, u64, port_sec_type_t),
    _realized_PortSecurityMAC(u64, u64),
    _delta_PortSecurityMAC(bool, u64, u64),
    _realized_LPortStatefulACL(u64),
    _delta_LPortStatefulACL(bool, u64),
    _realized_LPortLBVIP(u64, ip4_addr_port_t),
    _delta_LPortLBVIP(bool, u64, ip4_addr_port_t),
    _realized_ACL(u64, u16, acl_dir_t, __lambda, acl_action_t),
    _delta_ACL(bool, u64, u16, acl_dir_t, __lambda, acl_action_t),
    _realized_LPortLBVIPIP(u64, u8, ip4_addr_port_t, ip4_addr_port_t),
    _delta_LPortLBVIPIP(bool, u64, u8, ip4_addr_port_t, ip4_addr_port_t),
    _realized_LPortMACIP(u64, u64, u64, ip_addr_t),
    _delta_LPortMACIP(bool, u64, u64, u64, ip_addr_t),
    _realized_LPortDHCP4AddrOpts(u64, u64, u32, dhcp4_options_t),
    _delta_LPortDHCP4AddrOpts(bool, u64, u64, u32, dhcp4_options_t),
    _realized_LPortDHCP6AddrOpts(u64, u64, Uint, Uint, dhcp6_options_t),
    _delta_LPortDHCP6AddrOpts(bool, u64, u64, Uint, Uint, dhcp6_options_t),
    _realized_LSwitchAtChassis(u32, u64, destination_t),
    _delta_LSwitchAtChassis(bool, u32, u64, destination_t),
    _realized_MACChassis(u64, u64, destination_t),
    _delta_MACChassis(bool, u64, u64, destination_t),
    _realized_UnknownMACChassis(u32, u64, destination_t),
    _delta_UnknownMACChassis(bool, u32, u64, destination_t),
    _realized_PortSecurityIP4Match(u64, u64, ip4_subnet_t),
    _delta_PortSecurityIP4Match(bool, u64, u64, ip4_subnet_t),
    _realized_PortSecurityIP(u64, u64, ip_subnet_t),
    _delta_PortSecurityIP(bool, u64, u64, ip_subnet_t),
    _realized_PortSecurityIP6Match(u64, u64, ip6_subnet_t),
    _delta_PortSecurityIP6Match(bool, u64, u64, ip6_subnet_t),
    _realized_LogicalRouterPort(u32, String, u64, lrouter_port_type_t, u64, bool, opt_peer_t, u16),
    _delta_LogicalRouterPort(bool, u32, String, u64, lrouter_port_type_t, u64, bool, opt_peer_t, u16),
    _realized_NATChassis(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, u64, u32),
    _delta_NATChassis(bool, u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, u64, u32),
    _realized_LRouterNetwork(u64, ip_subnet_t),
    _delta_LRouterNetwork(bool, u64, ip_subnet_t),
    _realized_LRouterPortNetwork(u32, ip_subnet_t),
    _delta_LRouterPortNetwork(bool, u32, ip_subnet_t),
    _realized_LRouterLBVIP(u64, u32),
    _delta_LRouterLBVIP(bool, u64, u32),
    _realized_NAT(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, opt_lport_id_t),
    _delta_NAT(bool, u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, opt_lport_id_t),
    _realized_LearnedAddress(u32, ip_addr_t, u64),
    _delta_LearnedAddress(bool, u32, ip_addr_t, u64),
    _realized_TunnelFromTo(u32, u32, u32),
    _delta_TunnelFromTo(bool, u32, u32, u32),
    _realized_TunnelPort(u64, u16, u32, u32),
    _delta_TunnelPort(bool, u64, u16, u32, u32),
    _realized_Route(u64, ip_subnet_t, opt_ip_addr_t, u32, u64, ip_addr_t),
    _delta_Route(bool, u64, ip_subnet_t, opt_ip_addr_t, u32, u64, ip_addr_t),
    _realized_LPortAtChassis(u64, u64, u32, bool),
    _delta_LPortAtChassis(bool, u64, u64, u32, bool),
    _realized_LPortMACChassis(u64, u64, u64, u32, bool),
    _delta_LPortMACChassis(bool, u64, u64, u64, u32, bool),
    _realized_LPortUnknownMACChassis(u64, u64, u32, bool),
    _delta_LPortUnknownMACChassis(bool, u64, u64, u32, bool),
    _realized_LPortLB(u64),
    _delta_LPortLB(bool, u64),
    _realized_Chassis(u32, bool, String, String),
    _delta_Chassis(bool, u32, bool, String, String)
}
#[derive(Serialize, Deserialize, Debug)]
enum Relation {
    LogicalSwitch,
    Chassis,
    LogicalRouter,
    LogicalRouterPort,
    DHCPv4Options,
    DHCPv6Options,
    PhysicalNetwork,
    LogicalSwitchPort,
    LogicalSwitchPortMAC,
    LogicalSwitchPortIP,
    LogicalSwitchPortDynAddr,
    VSwitchPort,
    LPortBinding,
    PortSecurityMAC,
    PortSecurityIP,
    AddressSet,
    AddressSetAddr,
    LoadBalancer,
    LBSwitch,
    LBVIP,
    LBIP,
    ACL,
    LBRouter,
    LRouterPortNetwork,
    LogicalRouterStaticRoute,
    NAT,
    LearnedAddress,
    TunnelPort,
    TrunkPort,
    PortSecurityEnabled,
    PortIPSecurityEnabled,
    PortSecurityType,
    PortSecurityIP4Match,
    PortSecurityIP6Match,
    LPortStatefulACL,
    LPortLBVIP,
    LPortLBVIPIP,
    LPortLB,
    LPortMACIP,
    LPortDHCP4AddrOpts,
    LPortDHCP6AddrOpts,
    LPortAtChassis,
    LPortMACChassis,
    LPortUnknownMACChassis,
    LSwitchAtChassis,
    MACChassis,
    UnknownMACChassis,
    TunnelFromTo,
    LRouterNetwork,
    LRouterLBVIP,
    NATChassis,
    Route,
    _realized_VSwitchPort,
    _delta_VSwitchPort,
    _realized_LPortBinding,
    _delta_LPortBinding,
    _realized_LogicalSwitchPort,
    _delta_LogicalSwitchPort,
    _realized_PortSecurityType,
    _delta_PortSecurityType,
    _realized_PortSecurityMAC,
    _delta_PortSecurityMAC,
    _realized_LPortStatefulACL,
    _delta_LPortStatefulACL,
    _realized_LPortLBVIP,
    _delta_LPortLBVIP,
    _realized_ACL,
    _delta_ACL,
    _realized_LPortLBVIPIP,
    _delta_LPortLBVIPIP,
    _realized_LPortMACIP,
    _delta_LPortMACIP,
    _realized_LPortDHCP4AddrOpts,
    _delta_LPortDHCP4AddrOpts,
    _realized_LPortDHCP6AddrOpts,
    _delta_LPortDHCP6AddrOpts,
    _realized_LSwitchAtChassis,
    _delta_LSwitchAtChassis,
    _realized_MACChassis,
    _delta_MACChassis,
    _realized_UnknownMACChassis,
    _delta_UnknownMACChassis,
    _realized_PortSecurityIP4Match,
    _delta_PortSecurityIP4Match,
    _realized_PortSecurityIP,
    _delta_PortSecurityIP,
    _realized_PortSecurityIP6Match,
    _delta_PortSecurityIP6Match,
    _realized_LogicalRouterPort,
    _delta_LogicalRouterPort,
    _realized_NATChassis,
    _delta_NATChassis,
    _realized_LRouterNetwork,
    _delta_LRouterNetwork,
    _realized_LRouterPortNetwork,
    _delta_LRouterPortNetwork,
    _realized_LRouterLBVIP,
    _delta_LRouterLBVIP,
    _realized_NAT,
    _delta_NAT,
    _realized_LearnedAddress,
    _delta_LearnedAddress,
    _realized_TunnelFromTo,
    _delta_TunnelFromTo,
    _realized_TunnelPort,
    _delta_TunnelPort,
    _realized_Route,
    _delta_Route,
    _realized_LPortAtChassis,
    _delta_LPortAtChassis,
    _realized_LPortMACChassis,
    _delta_LPortMACChassis,
    _realized_LPortUnknownMACChassis,
    _delta_LPortUnknownMACChassis,
    _realized_LPortLB,
    _delta_LPortLB,
    _realized_Chassis,
    _delta_Chassis
}


#[derive(Serialize, Deserialize, Debug)]
enum Request {
    start,
    rollback,
    commit,
    add(Fact),
    del(Fact),
    chk(Relation),
    enm(Relation)
}

#[derive(Serialize, Deserialize, Debug)]
enum Response<T> {
    err(String),
    ok(T)
}

fn xupd<T>(s: &Rc<RefCell<HashSet<T>>>, ds: &Rc<RefCell<HashMap<T, i8>>>, x:&T, w: isize) 
where T: Eq + Hash + Clone + Debug {
    if w > 0 {
        let new = s.borrow_mut().insert(x.clone());
        if new {
            let f = |e: &mut i8| if *e == -1 {*e = 0;} else if *e == 0 {*e = 1};
            f(ds.borrow_mut().entry(x.clone()).or_insert(0));
        };
    } else if w < 0 {
        let present = s.borrow_mut().remove(x);
        if present {
            let f = |e: &mut i8| if *e == 1 {*e = 0;} else if *e == 0 {*e = -1;};
            f(ds.borrow_mut().entry(x.clone()).or_insert(0));
        };
    }
}

fn upd<T>(s: &Rc<RefCell<HashSet<T>>>, x:&T, w: isize) 
where T: Eq + Hash + Clone + Debug {
    if w > 0 {
        s.borrow_mut().insert(x.clone());
    } else if w < 0 {
        s.borrow_mut().remove(x);
    }
}

fn main() {

    // start up timely computation
    timely::execute_from_args(std::env::args(), |worker| {
        let probe = probe::Handle::new();
        let mut probe1 = probe.clone();

        let mut xaction : bool = false;

        let mut _rLogicalSwitch: Rc<RefCell<HashSet<(u64, lswitch_type_t, String, opt_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLogicalSwitch: Rc<RefCell<HashSet<(u64, lswitch_type_t, String, opt_subnet_t)>>> = _rLogicalSwitch.clone();
        let mut _rChassis: Rc<RefCell<HashSet<(u32, bool, String, String)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wChassis: Rc<RefCell<HashSet<(u32, bool, String, String)>>> = _rChassis.clone();
        let mut _rLogicalRouter: Rc<RefCell<HashSet<(u64, bool, String, lrouter_type_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLogicalRouter: Rc<RefCell<HashSet<(u64, bool, String, lrouter_type_t)>>> = _rLogicalRouter.clone();
        let mut _rLogicalRouterPort: Rc<RefCell<HashSet<(u32, String, u64, lrouter_port_type_t, u64, bool, opt_peer_t, u16)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLogicalRouterPort: Rc<RefCell<HashSet<(u32, String, u64, lrouter_port_type_t, u64, bool, opt_peer_t, u16)>>> = _rLogicalRouterPort.clone();
        let mut _rDHCPv4Options: Rc<RefCell<HashSet<(u64, dhcp4_options_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wDHCPv4Options: Rc<RefCell<HashSet<(u64, dhcp4_options_t)>>> = _rDHCPv4Options.clone();
        let mut _rDHCPv6Options: Rc<RefCell<HashSet<(u64, Uint, dhcp6_options_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wDHCPv6Options: Rc<RefCell<HashSet<(u64, Uint, dhcp6_options_t)>>> = _rDHCPv6Options.clone();
        let mut _rPhysicalNetwork: Rc<RefCell<HashSet<(u64, String)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wPhysicalNetwork: Rc<RefCell<HashSet<(u64, String)>>> = _rPhysicalNetwork.clone();
        let mut _rLogicalSwitchPort: Rc<RefCell<HashSet<(u64, u64, lport_type_t, String, bool, opt_dhcp4_options_id_t, opt_dhcp6_options_id_t, bool, u16)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLogicalSwitchPort: Rc<RefCell<HashSet<(u64, u64, lport_type_t, String, bool, opt_dhcp4_options_id_t, opt_dhcp6_options_id_t, bool, u16)>>> = _rLogicalSwitchPort.clone();
        let mut _rLogicalSwitchPortMAC: Rc<RefCell<HashSet<(u64, u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLogicalSwitchPortMAC: Rc<RefCell<HashSet<(u64, u64)>>> = _rLogicalSwitchPortMAC.clone();
        let mut _rLogicalSwitchPortIP: Rc<RefCell<HashSet<(u64, u64, ip_addr_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLogicalSwitchPortIP: Rc<RefCell<HashSet<(u64, u64, ip_addr_t)>>> = _rLogicalSwitchPortIP.clone();
        let mut _rLogicalSwitchPortDynAddr: Rc<RefCell<HashSet<(u64, u64, u64, opt_ip_addr_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLogicalSwitchPortDynAddr: Rc<RefCell<HashSet<(u64, u64, u64, opt_ip_addr_t)>>> = _rLogicalSwitchPortDynAddr.clone();
        let mut _rVSwitchPort: Rc<RefCell<HashSet<(u64, String, u32, u16)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wVSwitchPort: Rc<RefCell<HashSet<(u64, String, u32, u16)>>> = _rVSwitchPort.clone();
        let mut _rLPortBinding: Rc<RefCell<HashSet<(u64, u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLPortBinding: Rc<RefCell<HashSet<(u64, u64)>>> = _rLPortBinding.clone();
        let mut _rPortSecurityMAC: Rc<RefCell<HashSet<(u64, u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wPortSecurityMAC: Rc<RefCell<HashSet<(u64, u64)>>> = _rPortSecurityMAC.clone();
        let mut _rPortSecurityIP: Rc<RefCell<HashSet<(u64, u64, ip_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wPortSecurityIP: Rc<RefCell<HashSet<(u64, u64, ip_subnet_t)>>> = _rPortSecurityIP.clone();
        let mut _rAddressSet: Rc<RefCell<HashSet<(u64, String)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wAddressSet: Rc<RefCell<HashSet<(u64, String)>>> = _rAddressSet.clone();
        let mut _rAddressSetAddr: Rc<RefCell<HashSet<(u64, ip_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wAddressSetAddr: Rc<RefCell<HashSet<(u64, ip_subnet_t)>>> = _rAddressSetAddr.clone();
        let mut _rLoadBalancer: Rc<RefCell<HashSet<(u64, String, u8)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLoadBalancer: Rc<RefCell<HashSet<(u64, String, u8)>>> = _rLoadBalancer.clone();
        let mut _rLBSwitch: Rc<RefCell<HashSet<(u64, u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLBSwitch: Rc<RefCell<HashSet<(u64, u64)>>> = _rLBSwitch.clone();
        let mut _rLBVIP: Rc<RefCell<HashSet<(u64, ip4_addr_port_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLBVIP: Rc<RefCell<HashSet<(u64, ip4_addr_port_t)>>> = _rLBVIP.clone();
        let mut _rLBIP: Rc<RefCell<HashSet<(u64, ip4_addr_port_t, ip4_addr_port_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLBIP: Rc<RefCell<HashSet<(u64, ip4_addr_port_t, ip4_addr_port_t)>>> = _rLBIP.clone();
        let mut _rACL: Rc<RefCell<HashSet<(u64, u16, acl_dir_t, __lambda, acl_action_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wACL: Rc<RefCell<HashSet<(u64, u16, acl_dir_t, __lambda, acl_action_t)>>> = _rACL.clone();
        let mut _rLBRouter: Rc<RefCell<HashSet<(u64, u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLBRouter: Rc<RefCell<HashSet<(u64, u64)>>> = _rLBRouter.clone();
        let mut _rLRouterPortNetwork: Rc<RefCell<HashSet<(u32, ip_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLRouterPortNetwork: Rc<RefCell<HashSet<(u32, ip_subnet_t)>>> = _rLRouterPortNetwork.clone();
        let mut _rLogicalRouterStaticRoute: Rc<RefCell<HashSet<(u64, ip_subnet_t, ip_addr_t, u32)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLogicalRouterStaticRoute: Rc<RefCell<HashSet<(u64, ip_subnet_t, ip_addr_t, u32)>>> = _rLogicalRouterStaticRoute.clone();
        let mut _rNAT: Rc<RefCell<HashSet<(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, opt_lport_id_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wNAT: Rc<RefCell<HashSet<(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, opt_lport_id_t)>>> = _rNAT.clone();
        let mut _rLearnedAddress: Rc<RefCell<HashSet<(u32, ip_addr_t, u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLearnedAddress: Rc<RefCell<HashSet<(u32, ip_addr_t, u64)>>> = _rLearnedAddress.clone();
        let mut _rTunnelPort: Rc<RefCell<HashSet<(u64, u16, u32, u32)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wTunnelPort: Rc<RefCell<HashSet<(u64, u16, u32, u32)>>> = _rTunnelPort.clone();
        let mut _rTrunkPort: Rc<RefCell<HashSet<(u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wTrunkPort: Rc<RefCell<HashSet<(u64)>>> = _rTrunkPort.clone();
        let mut _rPortSecurityEnabled: Rc<RefCell<HashSet<(u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wPortSecurityEnabled: Rc<RefCell<HashSet<(u64)>>> = _rPortSecurityEnabled.clone();
        let mut _rPortIPSecurityEnabled: Rc<RefCell<HashSet<(u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wPortIPSecurityEnabled: Rc<RefCell<HashSet<(u64)>>> = _rPortIPSecurityEnabled.clone();
        let mut _rPortSecurityType: Rc<RefCell<HashSet<(u64, port_sec_type_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wPortSecurityType: Rc<RefCell<HashSet<(u64, port_sec_type_t)>>> = _rPortSecurityType.clone();
        let mut _rPortSecurityIP4Match: Rc<RefCell<HashSet<(u64, u64, ip4_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wPortSecurityIP4Match: Rc<RefCell<HashSet<(u64, u64, ip4_subnet_t)>>> = _rPortSecurityIP4Match.clone();
        let mut _rPortSecurityIP6Match: Rc<RefCell<HashSet<(u64, u64, ip6_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wPortSecurityIP6Match: Rc<RefCell<HashSet<(u64, u64, ip6_subnet_t)>>> = _rPortSecurityIP6Match.clone();
        let mut _rLPortStatefulACL: Rc<RefCell<HashSet<(u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLPortStatefulACL: Rc<RefCell<HashSet<(u64)>>> = _rLPortStatefulACL.clone();
        let mut _rLPortLBVIP: Rc<RefCell<HashSet<(u64, ip4_addr_port_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLPortLBVIP: Rc<RefCell<HashSet<(u64, ip4_addr_port_t)>>> = _rLPortLBVIP.clone();
        let mut _rLPortLBVIPIP: Rc<RefCell<HashSet<(u64, u8, ip4_addr_port_t, ip4_addr_port_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLPortLBVIPIP: Rc<RefCell<HashSet<(u64, u8, ip4_addr_port_t, ip4_addr_port_t)>>> = _rLPortLBVIPIP.clone();
        let mut _rLPortLB: Rc<RefCell<HashSet<(u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLPortLB: Rc<RefCell<HashSet<(u64)>>> = _rLPortLB.clone();
        let mut _rLPortMACIP: Rc<RefCell<HashSet<(u64, u64, u64, ip_addr_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLPortMACIP: Rc<RefCell<HashSet<(u64, u64, u64, ip_addr_t)>>> = _rLPortMACIP.clone();
        let mut _rLPortDHCP4AddrOpts: Rc<RefCell<HashSet<(u64, u64, u32, dhcp4_options_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLPortDHCP4AddrOpts: Rc<RefCell<HashSet<(u64, u64, u32, dhcp4_options_t)>>> = _rLPortDHCP4AddrOpts.clone();
        let mut _rLPortDHCP6AddrOpts: Rc<RefCell<HashSet<(u64, u64, Uint, Uint, dhcp6_options_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLPortDHCP6AddrOpts: Rc<RefCell<HashSet<(u64, u64, Uint, Uint, dhcp6_options_t)>>> = _rLPortDHCP6AddrOpts.clone();
        let mut _rLPortAtChassis: Rc<RefCell<HashSet<(u64, u64, u32, bool)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLPortAtChassis: Rc<RefCell<HashSet<(u64, u64, u32, bool)>>> = _rLPortAtChassis.clone();
        let mut _rLPortMACChassis: Rc<RefCell<HashSet<(u64, u64, u64, u32, bool)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLPortMACChassis: Rc<RefCell<HashSet<(u64, u64, u64, u32, bool)>>> = _rLPortMACChassis.clone();
        let mut _rLPortUnknownMACChassis: Rc<RefCell<HashSet<(u64, u64, u32, bool)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLPortUnknownMACChassis: Rc<RefCell<HashSet<(u64, u64, u32, bool)>>> = _rLPortUnknownMACChassis.clone();
        let mut _rLSwitchAtChassis: Rc<RefCell<HashSet<(u32, u64, destination_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLSwitchAtChassis: Rc<RefCell<HashSet<(u32, u64, destination_t)>>> = _rLSwitchAtChassis.clone();
        let mut _rMACChassis: Rc<RefCell<HashSet<(u64, u64, destination_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wMACChassis: Rc<RefCell<HashSet<(u64, u64, destination_t)>>> = _rMACChassis.clone();
        let mut _rUnknownMACChassis: Rc<RefCell<HashSet<(u32, u64, destination_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wUnknownMACChassis: Rc<RefCell<HashSet<(u32, u64, destination_t)>>> = _rUnknownMACChassis.clone();
        let mut _rTunnelFromTo: Rc<RefCell<HashSet<(u32, u32, u32)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wTunnelFromTo: Rc<RefCell<HashSet<(u32, u32, u32)>>> = _rTunnelFromTo.clone();
        let mut _rLRouterNetwork: Rc<RefCell<HashSet<(u64, ip_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLRouterNetwork: Rc<RefCell<HashSet<(u64, ip_subnet_t)>>> = _rLRouterNetwork.clone();
        let mut _rLRouterLBVIP: Rc<RefCell<HashSet<(u64, u32)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wLRouterLBVIP: Rc<RefCell<HashSet<(u64, u32)>>> = _rLRouterLBVIP.clone();
        let mut _rNATChassis: Rc<RefCell<HashSet<(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, u64, u32)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wNATChassis: Rc<RefCell<HashSet<(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, u64, u32)>>> = _rNATChassis.clone();
        let mut _rRoute: Rc<RefCell<HashSet<(u64, ip_subnet_t, opt_ip_addr_t, u32, u64, ip_addr_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _wRoute: Rc<RefCell<HashSet<(u64, ip_subnet_t, opt_ip_addr_t, u32, u64, ip_addr_t)>>> = _rRoute.clone();
        let mut _r_realized_VSwitchPort: Rc<RefCell<HashSet<(u64, String, u32, u16)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_VSwitchPort: Rc<RefCell<HashSet<(u64, String, u32, u16)>>> = _r_realized_VSwitchPort.clone();
        let mut _r_delta_VSwitchPort: Rc<RefCell<HashSet<(bool, u64, String, u32, u16)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_VSwitchPort: Rc<RefCell<HashSet<(bool, u64, String, u32, u16)>>> = _r_delta_VSwitchPort.clone();
        let mut _r_realized_LPortBinding: Rc<RefCell<HashSet<(u64, u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LPortBinding: Rc<RefCell<HashSet<(u64, u64)>>> = _r_realized_LPortBinding.clone();
        let mut _r_delta_LPortBinding: Rc<RefCell<HashSet<(bool, u64, u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LPortBinding: Rc<RefCell<HashSet<(bool, u64, u64)>>> = _r_delta_LPortBinding.clone();
        let mut _r_realized_LogicalSwitchPort: Rc<RefCell<HashSet<(u64, u64, lport_type_t, String, bool, opt_dhcp4_options_id_t, opt_dhcp6_options_id_t, bool, u16)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LogicalSwitchPort: Rc<RefCell<HashSet<(u64, u64, lport_type_t, String, bool, opt_dhcp4_options_id_t, opt_dhcp6_options_id_t, bool, u16)>>> = _r_realized_LogicalSwitchPort.clone();
        let mut _r_delta_LogicalSwitchPort: Rc<RefCell<HashSet<(bool, u64, u64, lport_type_t, String, bool, opt_dhcp4_options_id_t, opt_dhcp6_options_id_t, bool, u16)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LogicalSwitchPort: Rc<RefCell<HashSet<(bool, u64, u64, lport_type_t, String, bool, opt_dhcp4_options_id_t, opt_dhcp6_options_id_t, bool, u16)>>> = _r_delta_LogicalSwitchPort.clone();
        let mut _r_realized_PortSecurityType: Rc<RefCell<HashSet<(u64, port_sec_type_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_PortSecurityType: Rc<RefCell<HashSet<(u64, port_sec_type_t)>>> = _r_realized_PortSecurityType.clone();
        let mut _r_delta_PortSecurityType: Rc<RefCell<HashSet<(bool, u64, port_sec_type_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_PortSecurityType: Rc<RefCell<HashSet<(bool, u64, port_sec_type_t)>>> = _r_delta_PortSecurityType.clone();
        let mut _r_realized_PortSecurityMAC: Rc<RefCell<HashSet<(u64, u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_PortSecurityMAC: Rc<RefCell<HashSet<(u64, u64)>>> = _r_realized_PortSecurityMAC.clone();
        let mut _r_delta_PortSecurityMAC: Rc<RefCell<HashSet<(bool, u64, u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_PortSecurityMAC: Rc<RefCell<HashSet<(bool, u64, u64)>>> = _r_delta_PortSecurityMAC.clone();
        let mut _r_realized_LPortStatefulACL: Rc<RefCell<HashSet<(u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LPortStatefulACL: Rc<RefCell<HashSet<(u64)>>> = _r_realized_LPortStatefulACL.clone();
        let mut _r_delta_LPortStatefulACL: Rc<RefCell<HashSet<(bool, u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LPortStatefulACL: Rc<RefCell<HashSet<(bool, u64)>>> = _r_delta_LPortStatefulACL.clone();
        let mut _r_realized_LPortLBVIP: Rc<RefCell<HashSet<(u64, ip4_addr_port_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LPortLBVIP: Rc<RefCell<HashSet<(u64, ip4_addr_port_t)>>> = _r_realized_LPortLBVIP.clone();
        let mut _r_delta_LPortLBVIP: Rc<RefCell<HashSet<(bool, u64, ip4_addr_port_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LPortLBVIP: Rc<RefCell<HashSet<(bool, u64, ip4_addr_port_t)>>> = _r_delta_LPortLBVIP.clone();
        let mut _r_realized_ACL: Rc<RefCell<HashSet<(u64, u16, acl_dir_t, __lambda, acl_action_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_ACL: Rc<RefCell<HashSet<(u64, u16, acl_dir_t, __lambda, acl_action_t)>>> = _r_realized_ACL.clone();
        let mut _r_delta_ACL: Rc<RefCell<HashSet<(bool, u64, u16, acl_dir_t, __lambda, acl_action_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_ACL: Rc<RefCell<HashSet<(bool, u64, u16, acl_dir_t, __lambda, acl_action_t)>>> = _r_delta_ACL.clone();
        let mut _r_realized_LPortLBVIPIP: Rc<RefCell<HashSet<(u64, u8, ip4_addr_port_t, ip4_addr_port_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LPortLBVIPIP: Rc<RefCell<HashSet<(u64, u8, ip4_addr_port_t, ip4_addr_port_t)>>> = _r_realized_LPortLBVIPIP.clone();
        let mut _r_delta_LPortLBVIPIP: Rc<RefCell<HashSet<(bool, u64, u8, ip4_addr_port_t, ip4_addr_port_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LPortLBVIPIP: Rc<RefCell<HashSet<(bool, u64, u8, ip4_addr_port_t, ip4_addr_port_t)>>> = _r_delta_LPortLBVIPIP.clone();
        let mut _r_realized_LPortMACIP: Rc<RefCell<HashSet<(u64, u64, u64, ip_addr_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LPortMACIP: Rc<RefCell<HashSet<(u64, u64, u64, ip_addr_t)>>> = _r_realized_LPortMACIP.clone();
        let mut _r_delta_LPortMACIP: Rc<RefCell<HashSet<(bool, u64, u64, u64, ip_addr_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LPortMACIP: Rc<RefCell<HashSet<(bool, u64, u64, u64, ip_addr_t)>>> = _r_delta_LPortMACIP.clone();
        let mut _r_realized_LPortDHCP4AddrOpts: Rc<RefCell<HashSet<(u64, u64, u32, dhcp4_options_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LPortDHCP4AddrOpts: Rc<RefCell<HashSet<(u64, u64, u32, dhcp4_options_t)>>> = _r_realized_LPortDHCP4AddrOpts.clone();
        let mut _r_delta_LPortDHCP4AddrOpts: Rc<RefCell<HashSet<(bool, u64, u64, u32, dhcp4_options_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LPortDHCP4AddrOpts: Rc<RefCell<HashSet<(bool, u64, u64, u32, dhcp4_options_t)>>> = _r_delta_LPortDHCP4AddrOpts.clone();
        let mut _r_realized_LPortDHCP6AddrOpts: Rc<RefCell<HashSet<(u64, u64, Uint, Uint, dhcp6_options_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LPortDHCP6AddrOpts: Rc<RefCell<HashSet<(u64, u64, Uint, Uint, dhcp6_options_t)>>> = _r_realized_LPortDHCP6AddrOpts.clone();
        let mut _r_delta_LPortDHCP6AddrOpts: Rc<RefCell<HashSet<(bool, u64, u64, Uint, Uint, dhcp6_options_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LPortDHCP6AddrOpts: Rc<RefCell<HashSet<(bool, u64, u64, Uint, Uint, dhcp6_options_t)>>> = _r_delta_LPortDHCP6AddrOpts.clone();
        let mut _r_realized_LSwitchAtChassis: Rc<RefCell<HashSet<(u32, u64, destination_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LSwitchAtChassis: Rc<RefCell<HashSet<(u32, u64, destination_t)>>> = _r_realized_LSwitchAtChassis.clone();
        let mut _r_delta_LSwitchAtChassis: Rc<RefCell<HashSet<(bool, u32, u64, destination_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LSwitchAtChassis: Rc<RefCell<HashSet<(bool, u32, u64, destination_t)>>> = _r_delta_LSwitchAtChassis.clone();
        let mut _r_realized_MACChassis: Rc<RefCell<HashSet<(u64, u64, destination_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_MACChassis: Rc<RefCell<HashSet<(u64, u64, destination_t)>>> = _r_realized_MACChassis.clone();
        let mut _r_delta_MACChassis: Rc<RefCell<HashSet<(bool, u64, u64, destination_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_MACChassis: Rc<RefCell<HashSet<(bool, u64, u64, destination_t)>>> = _r_delta_MACChassis.clone();
        let mut _r_realized_UnknownMACChassis: Rc<RefCell<HashSet<(u32, u64, destination_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_UnknownMACChassis: Rc<RefCell<HashSet<(u32, u64, destination_t)>>> = _r_realized_UnknownMACChassis.clone();
        let mut _r_delta_UnknownMACChassis: Rc<RefCell<HashSet<(bool, u32, u64, destination_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_UnknownMACChassis: Rc<RefCell<HashSet<(bool, u32, u64, destination_t)>>> = _r_delta_UnknownMACChassis.clone();
        let mut _r_realized_PortSecurityIP4Match: Rc<RefCell<HashSet<(u64, u64, ip4_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_PortSecurityIP4Match: Rc<RefCell<HashSet<(u64, u64, ip4_subnet_t)>>> = _r_realized_PortSecurityIP4Match.clone();
        let mut _r_delta_PortSecurityIP4Match: Rc<RefCell<HashSet<(bool, u64, u64, ip4_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_PortSecurityIP4Match: Rc<RefCell<HashSet<(bool, u64, u64, ip4_subnet_t)>>> = _r_delta_PortSecurityIP4Match.clone();
        let mut _r_realized_PortSecurityIP: Rc<RefCell<HashSet<(u64, u64, ip_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_PortSecurityIP: Rc<RefCell<HashSet<(u64, u64, ip_subnet_t)>>> = _r_realized_PortSecurityIP.clone();
        let mut _r_delta_PortSecurityIP: Rc<RefCell<HashSet<(bool, u64, u64, ip_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_PortSecurityIP: Rc<RefCell<HashSet<(bool, u64, u64, ip_subnet_t)>>> = _r_delta_PortSecurityIP.clone();
        let mut _r_realized_PortSecurityIP6Match: Rc<RefCell<HashSet<(u64, u64, ip6_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_PortSecurityIP6Match: Rc<RefCell<HashSet<(u64, u64, ip6_subnet_t)>>> = _r_realized_PortSecurityIP6Match.clone();
        let mut _r_delta_PortSecurityIP6Match: Rc<RefCell<HashSet<(bool, u64, u64, ip6_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_PortSecurityIP6Match: Rc<RefCell<HashSet<(bool, u64, u64, ip6_subnet_t)>>> = _r_delta_PortSecurityIP6Match.clone();
        let mut _r_realized_LogicalRouterPort: Rc<RefCell<HashSet<(u32, String, u64, lrouter_port_type_t, u64, bool, opt_peer_t, u16)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LogicalRouterPort: Rc<RefCell<HashSet<(u32, String, u64, lrouter_port_type_t, u64, bool, opt_peer_t, u16)>>> = _r_realized_LogicalRouterPort.clone();
        let mut _r_delta_LogicalRouterPort: Rc<RefCell<HashSet<(bool, u32, String, u64, lrouter_port_type_t, u64, bool, opt_peer_t, u16)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LogicalRouterPort: Rc<RefCell<HashSet<(bool, u32, String, u64, lrouter_port_type_t, u64, bool, opt_peer_t, u16)>>> = _r_delta_LogicalRouterPort.clone();
        let mut _r_realized_NATChassis: Rc<RefCell<HashSet<(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, u64, u32)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_NATChassis: Rc<RefCell<HashSet<(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, u64, u32)>>> = _r_realized_NATChassis.clone();
        let mut _r_delta_NATChassis: Rc<RefCell<HashSet<(bool, u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, u64, u32)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_NATChassis: Rc<RefCell<HashSet<(bool, u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, u64, u32)>>> = _r_delta_NATChassis.clone();
        let mut _r_realized_LRouterNetwork: Rc<RefCell<HashSet<(u64, ip_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LRouterNetwork: Rc<RefCell<HashSet<(u64, ip_subnet_t)>>> = _r_realized_LRouterNetwork.clone();
        let mut _r_delta_LRouterNetwork: Rc<RefCell<HashSet<(bool, u64, ip_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LRouterNetwork: Rc<RefCell<HashSet<(bool, u64, ip_subnet_t)>>> = _r_delta_LRouterNetwork.clone();
        let mut _r_realized_LRouterPortNetwork: Rc<RefCell<HashSet<(u32, ip_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LRouterPortNetwork: Rc<RefCell<HashSet<(u32, ip_subnet_t)>>> = _r_realized_LRouterPortNetwork.clone();
        let mut _r_delta_LRouterPortNetwork: Rc<RefCell<HashSet<(bool, u32, ip_subnet_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LRouterPortNetwork: Rc<RefCell<HashSet<(bool, u32, ip_subnet_t)>>> = _r_delta_LRouterPortNetwork.clone();
        let mut _r_realized_LRouterLBVIP: Rc<RefCell<HashSet<(u64, u32)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LRouterLBVIP: Rc<RefCell<HashSet<(u64, u32)>>> = _r_realized_LRouterLBVIP.clone();
        let mut _r_delta_LRouterLBVIP: Rc<RefCell<HashSet<(bool, u64, u32)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LRouterLBVIP: Rc<RefCell<HashSet<(bool, u64, u32)>>> = _r_delta_LRouterLBVIP.clone();
        let mut _r_realized_NAT: Rc<RefCell<HashSet<(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, opt_lport_id_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_NAT: Rc<RefCell<HashSet<(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, opt_lport_id_t)>>> = _r_realized_NAT.clone();
        let mut _r_delta_NAT: Rc<RefCell<HashSet<(bool, u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, opt_lport_id_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_NAT: Rc<RefCell<HashSet<(bool, u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, opt_lport_id_t)>>> = _r_delta_NAT.clone();
        let mut _r_realized_LearnedAddress: Rc<RefCell<HashSet<(u32, ip_addr_t, u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LearnedAddress: Rc<RefCell<HashSet<(u32, ip_addr_t, u64)>>> = _r_realized_LearnedAddress.clone();
        let mut _r_delta_LearnedAddress: Rc<RefCell<HashSet<(bool, u32, ip_addr_t, u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LearnedAddress: Rc<RefCell<HashSet<(bool, u32, ip_addr_t, u64)>>> = _r_delta_LearnedAddress.clone();
        let mut _r_realized_TunnelFromTo: Rc<RefCell<HashSet<(u32, u32, u32)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_TunnelFromTo: Rc<RefCell<HashSet<(u32, u32, u32)>>> = _r_realized_TunnelFromTo.clone();
        let mut _r_delta_TunnelFromTo: Rc<RefCell<HashSet<(bool, u32, u32, u32)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_TunnelFromTo: Rc<RefCell<HashSet<(bool, u32, u32, u32)>>> = _r_delta_TunnelFromTo.clone();
        let mut _r_realized_TunnelPort: Rc<RefCell<HashSet<(u64, u16, u32, u32)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_TunnelPort: Rc<RefCell<HashSet<(u64, u16, u32, u32)>>> = _r_realized_TunnelPort.clone();
        let mut _r_delta_TunnelPort: Rc<RefCell<HashSet<(bool, u64, u16, u32, u32)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_TunnelPort: Rc<RefCell<HashSet<(bool, u64, u16, u32, u32)>>> = _r_delta_TunnelPort.clone();
        let mut _r_realized_Route: Rc<RefCell<HashSet<(u64, ip_subnet_t, opt_ip_addr_t, u32, u64, ip_addr_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_Route: Rc<RefCell<HashSet<(u64, ip_subnet_t, opt_ip_addr_t, u32, u64, ip_addr_t)>>> = _r_realized_Route.clone();
        let mut _r_delta_Route: Rc<RefCell<HashSet<(bool, u64, ip_subnet_t, opt_ip_addr_t, u32, u64, ip_addr_t)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_Route: Rc<RefCell<HashSet<(bool, u64, ip_subnet_t, opt_ip_addr_t, u32, u64, ip_addr_t)>>> = _r_delta_Route.clone();
        let mut _r_realized_LPortAtChassis: Rc<RefCell<HashSet<(u64, u64, u32, bool)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LPortAtChassis: Rc<RefCell<HashSet<(u64, u64, u32, bool)>>> = _r_realized_LPortAtChassis.clone();
        let mut _r_delta_LPortAtChassis: Rc<RefCell<HashSet<(bool, u64, u64, u32, bool)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LPortAtChassis: Rc<RefCell<HashSet<(bool, u64, u64, u32, bool)>>> = _r_delta_LPortAtChassis.clone();
        let mut _r_realized_LPortMACChassis: Rc<RefCell<HashSet<(u64, u64, u64, u32, bool)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LPortMACChassis: Rc<RefCell<HashSet<(u64, u64, u64, u32, bool)>>> = _r_realized_LPortMACChassis.clone();
        let mut _r_delta_LPortMACChassis: Rc<RefCell<HashSet<(bool, u64, u64, u64, u32, bool)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LPortMACChassis: Rc<RefCell<HashSet<(bool, u64, u64, u64, u32, bool)>>> = _r_delta_LPortMACChassis.clone();
        let mut _r_realized_LPortUnknownMACChassis: Rc<RefCell<HashSet<(u64, u64, u32, bool)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LPortUnknownMACChassis: Rc<RefCell<HashSet<(u64, u64, u32, bool)>>> = _r_realized_LPortUnknownMACChassis.clone();
        let mut _r_delta_LPortUnknownMACChassis: Rc<RefCell<HashSet<(bool, u64, u64, u32, bool)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LPortUnknownMACChassis: Rc<RefCell<HashSet<(bool, u64, u64, u32, bool)>>> = _r_delta_LPortUnknownMACChassis.clone();
        let mut _r_realized_LPortLB: Rc<RefCell<HashSet<(u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_LPortLB: Rc<RefCell<HashSet<(u64)>>> = _r_realized_LPortLB.clone();
        let mut _r_delta_LPortLB: Rc<RefCell<HashSet<(bool, u64)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_LPortLB: Rc<RefCell<HashSet<(bool, u64)>>> = _r_delta_LPortLB.clone();
        let mut _r_realized_Chassis: Rc<RefCell<HashSet<(u32, bool, String, String)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_realized_Chassis: Rc<RefCell<HashSet<(u32, bool, String, String)>>> = _r_realized_Chassis.clone();
        let mut _r_delta_Chassis: Rc<RefCell<HashSet<(bool, u32, bool, String, String)>>> = Rc::new(RefCell::new(HashSet::new()));
        let mut _w_delta_Chassis: Rc<RefCell<HashSet<(bool, u32, bool, String, String)>>> = _r_delta_Chassis.clone();
        let mut __rDeltaLogicalSwitch: Rc<RefCell<HashMap<(u64, lswitch_type_t, String, opt_subnet_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLogicalSwitch: Rc<RefCell<HashMap<(u64, lswitch_type_t, String, opt_subnet_t), i8>>> = __rDeltaLogicalSwitch.clone();
        let mut __rDeltaChassis: Rc<RefCell<HashMap<(u32, bool, String, String), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaChassis: Rc<RefCell<HashMap<(u32, bool, String, String), i8>>> = __rDeltaChassis.clone();
        let mut __rDeltaLogicalRouter: Rc<RefCell<HashMap<(u64, bool, String, lrouter_type_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLogicalRouter: Rc<RefCell<HashMap<(u64, bool, String, lrouter_type_t), i8>>> = __rDeltaLogicalRouter.clone();
        let mut __rDeltaLogicalRouterPort: Rc<RefCell<HashMap<(u32, String, u64, lrouter_port_type_t, u64, bool, opt_peer_t, u16), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLogicalRouterPort: Rc<RefCell<HashMap<(u32, String, u64, lrouter_port_type_t, u64, bool, opt_peer_t, u16), i8>>> = __rDeltaLogicalRouterPort.clone();
        let mut __rDeltaDHCPv4Options: Rc<RefCell<HashMap<(u64, dhcp4_options_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaDHCPv4Options: Rc<RefCell<HashMap<(u64, dhcp4_options_t), i8>>> = __rDeltaDHCPv4Options.clone();
        let mut __rDeltaDHCPv6Options: Rc<RefCell<HashMap<(u64, Uint, dhcp6_options_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaDHCPv6Options: Rc<RefCell<HashMap<(u64, Uint, dhcp6_options_t), i8>>> = __rDeltaDHCPv6Options.clone();
        let mut __rDeltaPhysicalNetwork: Rc<RefCell<HashMap<(u64, String), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaPhysicalNetwork: Rc<RefCell<HashMap<(u64, String), i8>>> = __rDeltaPhysicalNetwork.clone();
        let mut __rDeltaLogicalSwitchPort: Rc<RefCell<HashMap<(u64, u64, lport_type_t, String, bool, opt_dhcp4_options_id_t, opt_dhcp6_options_id_t, bool, u16), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLogicalSwitchPort: Rc<RefCell<HashMap<(u64, u64, lport_type_t, String, bool, opt_dhcp4_options_id_t, opt_dhcp6_options_id_t, bool, u16), i8>>> = __rDeltaLogicalSwitchPort.clone();
        let mut __rDeltaLogicalSwitchPortMAC: Rc<RefCell<HashMap<(u64, u64), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLogicalSwitchPortMAC: Rc<RefCell<HashMap<(u64, u64), i8>>> = __rDeltaLogicalSwitchPortMAC.clone();
        let mut __rDeltaLogicalSwitchPortIP: Rc<RefCell<HashMap<(u64, u64, ip_addr_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLogicalSwitchPortIP: Rc<RefCell<HashMap<(u64, u64, ip_addr_t), i8>>> = __rDeltaLogicalSwitchPortIP.clone();
        let mut __rDeltaLogicalSwitchPortDynAddr: Rc<RefCell<HashMap<(u64, u64, u64, opt_ip_addr_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLogicalSwitchPortDynAddr: Rc<RefCell<HashMap<(u64, u64, u64, opt_ip_addr_t), i8>>> = __rDeltaLogicalSwitchPortDynAddr.clone();
        let mut __rDeltaVSwitchPort: Rc<RefCell<HashMap<(u64, String, u32, u16), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaVSwitchPort: Rc<RefCell<HashMap<(u64, String, u32, u16), i8>>> = __rDeltaVSwitchPort.clone();
        let mut __rDeltaLPortBinding: Rc<RefCell<HashMap<(u64, u64), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLPortBinding: Rc<RefCell<HashMap<(u64, u64), i8>>> = __rDeltaLPortBinding.clone();
        let mut __rDeltaPortSecurityMAC: Rc<RefCell<HashMap<(u64, u64), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaPortSecurityMAC: Rc<RefCell<HashMap<(u64, u64), i8>>> = __rDeltaPortSecurityMAC.clone();
        let mut __rDeltaPortSecurityIP: Rc<RefCell<HashMap<(u64, u64, ip_subnet_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaPortSecurityIP: Rc<RefCell<HashMap<(u64, u64, ip_subnet_t), i8>>> = __rDeltaPortSecurityIP.clone();
        let mut __rDeltaAddressSet: Rc<RefCell<HashMap<(u64, String), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaAddressSet: Rc<RefCell<HashMap<(u64, String), i8>>> = __rDeltaAddressSet.clone();
        let mut __rDeltaAddressSetAddr: Rc<RefCell<HashMap<(u64, ip_subnet_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaAddressSetAddr: Rc<RefCell<HashMap<(u64, ip_subnet_t), i8>>> = __rDeltaAddressSetAddr.clone();
        let mut __rDeltaLoadBalancer: Rc<RefCell<HashMap<(u64, String, u8), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLoadBalancer: Rc<RefCell<HashMap<(u64, String, u8), i8>>> = __rDeltaLoadBalancer.clone();
        let mut __rDeltaLBSwitch: Rc<RefCell<HashMap<(u64, u64), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLBSwitch: Rc<RefCell<HashMap<(u64, u64), i8>>> = __rDeltaLBSwitch.clone();
        let mut __rDeltaLBVIP: Rc<RefCell<HashMap<(u64, ip4_addr_port_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLBVIP: Rc<RefCell<HashMap<(u64, ip4_addr_port_t), i8>>> = __rDeltaLBVIP.clone();
        let mut __rDeltaLBIP: Rc<RefCell<HashMap<(u64, ip4_addr_port_t, ip4_addr_port_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLBIP: Rc<RefCell<HashMap<(u64, ip4_addr_port_t, ip4_addr_port_t), i8>>> = __rDeltaLBIP.clone();
        let mut __rDeltaACL: Rc<RefCell<HashMap<(u64, u16, acl_dir_t, __lambda, acl_action_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaACL: Rc<RefCell<HashMap<(u64, u16, acl_dir_t, __lambda, acl_action_t), i8>>> = __rDeltaACL.clone();
        let mut __rDeltaLBRouter: Rc<RefCell<HashMap<(u64, u64), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLBRouter: Rc<RefCell<HashMap<(u64, u64), i8>>> = __rDeltaLBRouter.clone();
        let mut __rDeltaLRouterPortNetwork: Rc<RefCell<HashMap<(u32, ip_subnet_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLRouterPortNetwork: Rc<RefCell<HashMap<(u32, ip_subnet_t), i8>>> = __rDeltaLRouterPortNetwork.clone();
        let mut __rDeltaLogicalRouterStaticRoute: Rc<RefCell<HashMap<(u64, ip_subnet_t, ip_addr_t, u32), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLogicalRouterStaticRoute: Rc<RefCell<HashMap<(u64, ip_subnet_t, ip_addr_t, u32), i8>>> = __rDeltaLogicalRouterStaticRoute.clone();
        let mut __rDeltaNAT: Rc<RefCell<HashMap<(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, opt_lport_id_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaNAT: Rc<RefCell<HashMap<(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, opt_lport_id_t), i8>>> = __rDeltaNAT.clone();
        let mut __rDeltaLearnedAddress: Rc<RefCell<HashMap<(u32, ip_addr_t, u64), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaLearnedAddress: Rc<RefCell<HashMap<(u32, ip_addr_t, u64), i8>>> = __rDeltaLearnedAddress.clone();
        let mut __rDeltaTunnelPort: Rc<RefCell<HashMap<(u64, u16, u32, u32), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDeltaTunnelPort: Rc<RefCell<HashMap<(u64, u16, u32, u32), i8>>> = __rDeltaTunnelPort.clone();
        let mut __rDelta_realized_VSwitchPort: Rc<RefCell<HashMap<(u64, String, u32, u16), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_VSwitchPort: Rc<RefCell<HashMap<(u64, String, u32, u16), i8>>> = __rDelta_realized_VSwitchPort.clone();
        let mut __rDelta_realized_LPortBinding: Rc<RefCell<HashMap<(u64, u64), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LPortBinding: Rc<RefCell<HashMap<(u64, u64), i8>>> = __rDelta_realized_LPortBinding.clone();
        let mut __rDelta_realized_LogicalSwitchPort: Rc<RefCell<HashMap<(u64, u64, lport_type_t, String, bool, opt_dhcp4_options_id_t, opt_dhcp6_options_id_t, bool, u16), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LogicalSwitchPort: Rc<RefCell<HashMap<(u64, u64, lport_type_t, String, bool, opt_dhcp4_options_id_t, opt_dhcp6_options_id_t, bool, u16), i8>>> = __rDelta_realized_LogicalSwitchPort.clone();
        let mut __rDelta_realized_PortSecurityType: Rc<RefCell<HashMap<(u64, port_sec_type_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_PortSecurityType: Rc<RefCell<HashMap<(u64, port_sec_type_t), i8>>> = __rDelta_realized_PortSecurityType.clone();
        let mut __rDelta_realized_PortSecurityMAC: Rc<RefCell<HashMap<(u64, u64), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_PortSecurityMAC: Rc<RefCell<HashMap<(u64, u64), i8>>> = __rDelta_realized_PortSecurityMAC.clone();
        let mut __rDelta_realized_LPortStatefulACL: Rc<RefCell<HashMap<(u64), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LPortStatefulACL: Rc<RefCell<HashMap<(u64), i8>>> = __rDelta_realized_LPortStatefulACL.clone();
        let mut __rDelta_realized_LPortLBVIP: Rc<RefCell<HashMap<(u64, ip4_addr_port_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LPortLBVIP: Rc<RefCell<HashMap<(u64, ip4_addr_port_t), i8>>> = __rDelta_realized_LPortLBVIP.clone();
        let mut __rDelta_realized_ACL: Rc<RefCell<HashMap<(u64, u16, acl_dir_t, __lambda, acl_action_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_ACL: Rc<RefCell<HashMap<(u64, u16, acl_dir_t, __lambda, acl_action_t), i8>>> = __rDelta_realized_ACL.clone();
        let mut __rDelta_realized_LPortLBVIPIP: Rc<RefCell<HashMap<(u64, u8, ip4_addr_port_t, ip4_addr_port_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LPortLBVIPIP: Rc<RefCell<HashMap<(u64, u8, ip4_addr_port_t, ip4_addr_port_t), i8>>> = __rDelta_realized_LPortLBVIPIP.clone();
        let mut __rDelta_realized_LPortMACIP: Rc<RefCell<HashMap<(u64, u64, u64, ip_addr_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LPortMACIP: Rc<RefCell<HashMap<(u64, u64, u64, ip_addr_t), i8>>> = __rDelta_realized_LPortMACIP.clone();
        let mut __rDelta_realized_LPortDHCP4AddrOpts: Rc<RefCell<HashMap<(u64, u64, u32, dhcp4_options_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LPortDHCP4AddrOpts: Rc<RefCell<HashMap<(u64, u64, u32, dhcp4_options_t), i8>>> = __rDelta_realized_LPortDHCP4AddrOpts.clone();
        let mut __rDelta_realized_LPortDHCP6AddrOpts: Rc<RefCell<HashMap<(u64, u64, Uint, Uint, dhcp6_options_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LPortDHCP6AddrOpts: Rc<RefCell<HashMap<(u64, u64, Uint, Uint, dhcp6_options_t), i8>>> = __rDelta_realized_LPortDHCP6AddrOpts.clone();
        let mut __rDelta_realized_LSwitchAtChassis: Rc<RefCell<HashMap<(u32, u64, destination_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LSwitchAtChassis: Rc<RefCell<HashMap<(u32, u64, destination_t), i8>>> = __rDelta_realized_LSwitchAtChassis.clone();
        let mut __rDelta_realized_MACChassis: Rc<RefCell<HashMap<(u64, u64, destination_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_MACChassis: Rc<RefCell<HashMap<(u64, u64, destination_t), i8>>> = __rDelta_realized_MACChassis.clone();
        let mut __rDelta_realized_UnknownMACChassis: Rc<RefCell<HashMap<(u32, u64, destination_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_UnknownMACChassis: Rc<RefCell<HashMap<(u32, u64, destination_t), i8>>> = __rDelta_realized_UnknownMACChassis.clone();
        let mut __rDelta_realized_PortSecurityIP4Match: Rc<RefCell<HashMap<(u64, u64, ip4_subnet_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_PortSecurityIP4Match: Rc<RefCell<HashMap<(u64, u64, ip4_subnet_t), i8>>> = __rDelta_realized_PortSecurityIP4Match.clone();
        let mut __rDelta_realized_PortSecurityIP: Rc<RefCell<HashMap<(u64, u64, ip_subnet_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_PortSecurityIP: Rc<RefCell<HashMap<(u64, u64, ip_subnet_t), i8>>> = __rDelta_realized_PortSecurityIP.clone();
        let mut __rDelta_realized_PortSecurityIP6Match: Rc<RefCell<HashMap<(u64, u64, ip6_subnet_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_PortSecurityIP6Match: Rc<RefCell<HashMap<(u64, u64, ip6_subnet_t), i8>>> = __rDelta_realized_PortSecurityIP6Match.clone();
        let mut __rDelta_realized_LogicalRouterPort: Rc<RefCell<HashMap<(u32, String, u64, lrouter_port_type_t, u64, bool, opt_peer_t, u16), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LogicalRouterPort: Rc<RefCell<HashMap<(u32, String, u64, lrouter_port_type_t, u64, bool, opt_peer_t, u16), i8>>> = __rDelta_realized_LogicalRouterPort.clone();
        let mut __rDelta_realized_NATChassis: Rc<RefCell<HashMap<(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, u64, u32), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_NATChassis: Rc<RefCell<HashMap<(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, u64, u32), i8>>> = __rDelta_realized_NATChassis.clone();
        let mut __rDelta_realized_LRouterNetwork: Rc<RefCell<HashMap<(u64, ip_subnet_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LRouterNetwork: Rc<RefCell<HashMap<(u64, ip_subnet_t), i8>>> = __rDelta_realized_LRouterNetwork.clone();
        let mut __rDelta_realized_LRouterPortNetwork: Rc<RefCell<HashMap<(u32, ip_subnet_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LRouterPortNetwork: Rc<RefCell<HashMap<(u32, ip_subnet_t), i8>>> = __rDelta_realized_LRouterPortNetwork.clone();
        let mut __rDelta_realized_LRouterLBVIP: Rc<RefCell<HashMap<(u64, u32), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LRouterLBVIP: Rc<RefCell<HashMap<(u64, u32), i8>>> = __rDelta_realized_LRouterLBVIP.clone();
        let mut __rDelta_realized_NAT: Rc<RefCell<HashMap<(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, opt_lport_id_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_NAT: Rc<RefCell<HashMap<(u64, nat_type_t, u32, opt_mac_addr_t, ip4_subnet_t, opt_lport_id_t), i8>>> = __rDelta_realized_NAT.clone();
        let mut __rDelta_realized_LearnedAddress: Rc<RefCell<HashMap<(u32, ip_addr_t, u64), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LearnedAddress: Rc<RefCell<HashMap<(u32, ip_addr_t, u64), i8>>> = __rDelta_realized_LearnedAddress.clone();
        let mut __rDelta_realized_TunnelFromTo: Rc<RefCell<HashMap<(u32, u32, u32), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_TunnelFromTo: Rc<RefCell<HashMap<(u32, u32, u32), i8>>> = __rDelta_realized_TunnelFromTo.clone();
        let mut __rDelta_realized_TunnelPort: Rc<RefCell<HashMap<(u64, u16, u32, u32), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_TunnelPort: Rc<RefCell<HashMap<(u64, u16, u32, u32), i8>>> = __rDelta_realized_TunnelPort.clone();
        let mut __rDelta_realized_Route: Rc<RefCell<HashMap<(u64, ip_subnet_t, opt_ip_addr_t, u32, u64, ip_addr_t), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_Route: Rc<RefCell<HashMap<(u64, ip_subnet_t, opt_ip_addr_t, u32, u64, ip_addr_t), i8>>> = __rDelta_realized_Route.clone();
        let mut __rDelta_realized_LPortAtChassis: Rc<RefCell<HashMap<(u64, u64, u32, bool), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LPortAtChassis: Rc<RefCell<HashMap<(u64, u64, u32, bool), i8>>> = __rDelta_realized_LPortAtChassis.clone();
        let mut __rDelta_realized_LPortMACChassis: Rc<RefCell<HashMap<(u64, u64, u64, u32, bool), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LPortMACChassis: Rc<RefCell<HashMap<(u64, u64, u64, u32, bool), i8>>> = __rDelta_realized_LPortMACChassis.clone();
        let mut __rDelta_realized_LPortUnknownMACChassis: Rc<RefCell<HashMap<(u64, u64, u32, bool), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LPortUnknownMACChassis: Rc<RefCell<HashMap<(u64, u64, u32, bool), i8>>> = __rDelta_realized_LPortUnknownMACChassis.clone();
        let mut __rDelta_realized_LPortLB: Rc<RefCell<HashMap<(u64), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_LPortLB: Rc<RefCell<HashMap<(u64), i8>>> = __rDelta_realized_LPortLB.clone();
        let mut __rDelta_realized_Chassis: Rc<RefCell<HashMap<(u32, bool, String, String), i8>>> = Rc::new(RefCell::new(HashMap::new()));
        let mut __wDelta_realized_Chassis: Rc<RefCell<HashMap<(u32, bool, String, String), i8>>> = __rDelta_realized_Chassis.clone();
        let (mut _LogicalSwitch,mut _Chassis,mut _LogicalRouter,mut _LogicalRouterPort,mut _DHCPv4Options,mut _DHCPv6Options,mut _PhysicalNetwork,mut _LogicalSwitchPort,mut _LogicalSwitchPortMAC,mut _LogicalSwitchPortIP,mut _LogicalSwitchPortDynAddr,mut _VSwitchPort,mut _LPortBinding,mut _PortSecurityMAC,mut _PortSecurityIP,mut _AddressSet,mut _AddressSetAddr,mut _LoadBalancer,mut _LBSwitch,mut _LBVIP,mut _LBIP,mut _ACL,mut _LBRouter,mut _LRouterPortNetwork,mut _LogicalRouterStaticRoute,mut _NAT,mut _LearnedAddress,mut _TunnelPort,mut _TrunkPort,mut _PortSecurityEnabled,mut _PortIPSecurityEnabled,mut _PortSecurityType,mut _PortSecurityIP4Match,mut _PortSecurityIP6Match,mut _LPortStatefulACL,mut _LPortLBVIP,mut _LPortLBVIPIP,mut _LPortLB,mut _LPortMACIP,mut _LPortDHCP4AddrOpts,mut _LPortDHCP6AddrOpts,mut _LPortAtChassis,mut _LPortMACChassis,mut _LPortUnknownMACChassis,mut _LSwitchAtChassis,mut _MACChassis,mut _UnknownMACChassis,mut _TunnelFromTo,mut _LRouterNetwork,mut _LRouterLBVIP,mut _NATChassis,mut _Route,mut __realized_VSwitchPort,mut __delta_VSwitchPort,mut __realized_LPortBinding,mut __delta_LPortBinding,mut __realized_LogicalSwitchPort,mut __delta_LogicalSwitchPort,mut __realized_PortSecurityType,mut __delta_PortSecurityType,mut __realized_PortSecurityMAC,mut __delta_PortSecurityMAC,mut __realized_LPortStatefulACL,mut __delta_LPortStatefulACL,mut __realized_LPortLBVIP,mut __delta_LPortLBVIP,mut __realized_ACL,mut __delta_ACL,mut __realized_LPortLBVIPIP,mut __delta_LPortLBVIPIP,mut __realized_LPortMACIP,mut __delta_LPortMACIP,mut __realized_LPortDHCP4AddrOpts,mut __delta_LPortDHCP4AddrOpts,mut __realized_LPortDHCP6AddrOpts,mut __delta_LPortDHCP6AddrOpts,mut __realized_LSwitchAtChassis,mut __delta_LSwitchAtChassis,mut __realized_MACChassis,mut __delta_MACChassis,mut __realized_UnknownMACChassis,mut __delta_UnknownMACChassis,mut __realized_PortSecurityIP4Match,mut __delta_PortSecurityIP4Match,mut __realized_PortSecurityIP,mut __delta_PortSecurityIP,mut __realized_PortSecurityIP6Match,mut __delta_PortSecurityIP6Match,mut __realized_LogicalRouterPort,mut __delta_LogicalRouterPort,mut __realized_NATChassis,mut __delta_NATChassis,mut __realized_LRouterNetwork,mut __delta_LRouterNetwork,mut __realized_LRouterPortNetwork,mut __delta_LRouterPortNetwork,mut __realized_LRouterLBVIP,mut __delta_LRouterLBVIP,mut __realized_NAT,mut __delta_NAT,mut __realized_LearnedAddress,mut __delta_LearnedAddress,mut __realized_TunnelFromTo,mut __delta_TunnelFromTo,mut __realized_TunnelPort,mut __delta_TunnelPort,mut __realized_Route,mut __delta_Route,mut __realized_LPortAtChassis,mut __delta_LPortAtChassis,mut __realized_LPortMACChassis,mut __delta_LPortMACChassis,mut __realized_LPortUnknownMACChassis,mut __delta_LPortUnknownMACChassis,mut __realized_LPortLB,mut __delta_LPortLB,mut __realized_Chassis,mut __delta_Chassis) = worker.dataflow::<u64,_,_>(move |outer| {
            let (mut _LogicalSwitch, LogicalSwitch) = outer.new_collection::<(u64,lswitch_type_t,String,opt_subnet_t),isize>();
            let LogicalSwitch = LogicalSwitch.distinct();
            let (mut _Chassis, Chassis) = outer.new_collection::<(u32,bool,String,String),isize>();
            let Chassis = Chassis.distinct();
            let (mut _LogicalRouter, LogicalRouter) = outer.new_collection::<(u64,bool,String,lrouter_type_t),isize>();
            let LogicalRouter = LogicalRouter.distinct();
            let (mut _LogicalRouterPort, LogicalRouterPort) = outer.new_collection::<(u32,String,u64,lrouter_port_type_t,u64,bool,opt_peer_t,u16),isize>();
            let LogicalRouterPort = LogicalRouterPort.distinct();
            let (mut _DHCPv4Options, DHCPv4Options) = outer.new_collection::<(u64,dhcp4_options_t),isize>();
            let DHCPv4Options = DHCPv4Options.distinct();
            let (mut _DHCPv6Options, DHCPv6Options) = outer.new_collection::<(u64,Uint,dhcp6_options_t),isize>();
            let DHCPv6Options = DHCPv6Options.distinct();
            let (mut _PhysicalNetwork, PhysicalNetwork) = outer.new_collection::<(u64,String),isize>();
            let PhysicalNetwork = PhysicalNetwork.distinct();
            let (mut _LogicalSwitchPort, LogicalSwitchPort) = outer.new_collection::<(u64,u64,lport_type_t,String,bool,opt_dhcp4_options_id_t,opt_dhcp6_options_id_t,bool,u16),isize>();
            let LogicalSwitchPort = LogicalSwitchPort.distinct();
            let (mut _TrunkPort, TrunkPort) = outer.new_collection::<u64,isize>();
            let TrunkPort = TrunkPort.concat(&(LogicalSwitchPort.map(|_x_| match _x_ {(lport,__ph0,__ph1,__ph2,__ph3,__ph4,__ph5,__ph6,__ph7) => (lport,())})
                                               .join_map(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortVIF{parent: _, tag_request: _, tag: _} => true, _ => false}).map(|_x_| match _x_ {(__ph8,__ph9,lport_type_t::LPortVIF{parent: lport, tag_request: __ph10, tag: __ph11},__ph12,__ph13,__ph14,__ph15,__ph16,__ph17) => (lport,()), _ => unreachable!()})), |lport, &(), &()| lport.clone())
                                               .map(|lport| lport.clone())));
            let TrunkPort = TrunkPort.distinct();
            let (mut _LogicalSwitchPortMAC, LogicalSwitchPortMAC) = outer.new_collection::<(u64,u64),isize>();
            let LogicalSwitchPortMAC = LogicalSwitchPortMAC.distinct();
            let (mut _LogicalSwitchPortIP, LogicalSwitchPortIP) = outer.new_collection::<(u64,u64,ip_addr_t),isize>();
            let LogicalSwitchPortIP = LogicalSwitchPortIP.distinct();
            let (mut _LogicalSwitchPortDynAddr, LogicalSwitchPortDynAddr) = outer.new_collection::<(u64,u64,u64,opt_ip_addr_t),isize>();
            let LogicalSwitchPortDynAddr = LogicalSwitchPortDynAddr.distinct();
            let (mut _LPortMACIP, LPortMACIP) = outer.new_collection::<(u64,u64,u64,ip_addr_t),isize>();
            let LPortMACIP = LPortMACIP.concat(&(LogicalSwitchPort.map(|_x_| match _x_ {(lport,lswitch,__ph0,__ph1,en,__ph2,__ph3,__ph4,__ph5) => (lport,(en,lswitch))})
                                                 .filter(|&(ref lport, (ref en,ref lswitch))| en.clone())
                                                 .join_map(&(LogicalSwitchPortDynAddr.filter(|&(ref id,ref lport,ref mac,ref ip)| match ip.clone() {opt_ip_addr_t::SomeIPAddr{addr: _} => true, _ => false}).map(|_x_| match _x_ {(__ph6,lport,mac,opt_ip_addr_t::SomeIPAddr{addr: ip}) => (lport,(ip,mac)), _ => unreachable!()})), |lport, &(ref en,ref lswitch), &(ref ip,ref mac)| (ip.clone(),lport.clone(),lswitch.clone(),mac.clone()))
                                                 .map(|(ip,lport,lswitch,mac)| (lswitch.clone(),lport.clone(),mac.clone(),ip.clone()))));
            let LPortMACIP = LPortMACIP.concat(&(LogicalSwitchPort.map(|_x_| match _x_ {(lport,lswitch,__ph0,__ph1,en,__ph2,__ph3,__ph4,__ph5) => (lport,(en,lswitch))})
                                                 .filter(|&(ref lport, (ref en,ref lswitch))| en.clone())
                                                 .join_map(&(LogicalSwitchPortIP.map(|_x_| match _x_ {(lport,mac,ip) => (lport,(ip,mac))})), |lport, &(ref en,ref lswitch), &(ref ip,ref mac)| (ip.clone(),lport.clone(),lswitch.clone(),mac.clone()))
                                                 .map(|(ip,lport,lswitch,mac)| (lswitch.clone(),lport.clone(),mac.clone(),ip.clone()))));
            let LPortMACIP = LPortMACIP.distinct();
            let (mut _LPortDHCP4AddrOpts, LPortDHCP4AddrOpts) = outer.new_collection::<(u64,u64,u32,dhcp4_options_t),isize>();
            let LPortDHCP4AddrOpts = LPortDHCP4AddrOpts.concat(&(LPortMACIP.filter(|&(ref lswitch,ref lport,ref mac,ref ip)| match ip.clone() {ip_addr_t::IPAddr4{addr4: _} => true, _ => false})
                                                                           .map(|_x_| match _x_ {(__ph0,lport,mac,ip_addr_t::IPAddr4{addr4: ip}) => (lport,(ip,mac)), _ => unreachable!()})
                                                                 .join_map(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match dhcp4_options.clone() {opt_dhcp4_options_id_t::SomeDHCP4Options{options: _} => true, _ => false}).map(|_x_| match _x_ {(lport,__ph1,__ph2,__ph3,en,opt_dhcp4_options_id_t::SomeDHCP4Options{options: optid},__ph4,__ph5,__ph6) => (lport,optid), _ => unreachable!()})), |lport, &(ref ip,ref mac), optid| (optid.clone(),(ip.clone(),lport.clone(),mac.clone())))
                                                                 .join_map(&(DHCPv4Options.map(|_x_| match _x_ {(optid,options) => (optid,options)})), |optid, &(ref ip,ref lport,ref mac), options| (ip.clone(),lport.clone(),mac.clone(),options.clone()))
                                                                 .map(|(ip,lport,mac,options)| (lport.clone(),mac.clone(),ip.clone(),options.clone()))));
            let LPortDHCP4AddrOpts = LPortDHCP4AddrOpts.distinct();
            let (mut _LPortDHCP6AddrOpts, LPortDHCP6AddrOpts) = outer.new_collection::<(u64,u64,Uint,Uint,dhcp6_options_t),isize>();
            let LPortDHCP6AddrOpts = LPortDHCP6AddrOpts.concat(&(LPortMACIP.filter(|&(ref lswitch,ref lport,ref mac,ref ip)| match ip.clone() {ip_addr_t::IPAddr6{addr6: _} => true, _ => false})
                                                                           .map(|_x_| match _x_ {(__ph0,lport,mac,ip_addr_t::IPAddr6{addr6: ip}) => (lport,(ip,mac)), _ => unreachable!()})
                                                                 .join_map(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match dhcp6_options.clone() {opt_dhcp6_options_id_t::SomeDHCP6Options{options: _} => true, _ => false}).map(|_x_| match _x_ {(lport,__ph1,__ph2,__ph3,en,__ph4,opt_dhcp6_options_id_t::SomeDHCP6Options{options: optid},__ph5,__ph6) => (lport,optid), _ => unreachable!()})), |lport, &(ref ip,ref mac), optid| (optid.clone(),(ip.clone(),lport.clone(),mac.clone())))
                                                                 .join_map(&(DHCPv6Options.map(|_x_| match _x_ {(optid,server_ip,options) => (optid,(options,server_ip))})), |optid, &(ref ip,ref lport,ref mac), &(ref options,ref server_ip)| (ip.clone(),lport.clone(),mac.clone(),options.clone(),server_ip.clone()))
                                                                 .map(|(ip,lport,mac,options,server_ip)| (lport.clone(),mac.clone(),ip.clone(),server_ip.clone(),options.clone()))));
            let LPortDHCP6AddrOpts = LPortDHCP6AddrOpts.distinct();
            let (mut _VSwitchPort, VSwitchPort) = outer.new_collection::<(u64,String,u32,u16),isize>();
            let VSwitchPort = VSwitchPort.distinct();
            let (mut _LPortBinding, LPortBinding) = outer.new_collection::<(u64,u64),isize>();
            let LPortBinding = LPortBinding.distinct();
            let (mut _LPortAtChassis, LPortAtChassis) = outer.new_collection::<(u64,u64,u32,bool),isize>();
            let LPortAtChassis = LPortAtChassis.concat(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortVM => true, _ => false})
                                                                          .map(|_x_| match _x_ {(lport,lswitch,lport_type_t::LPortVM{},__ph0,en,__ph1,__ph2,__ph3,__ph4) => (lport,(en,lswitch)), _ => unreachable!()})
                                                         .filter(|&(ref lport, (ref en,ref lswitch))| en.clone())
                                                         .antijoin(&(TrunkPort.map(|_x_| match _x_ {lport => lport})))
                                                         .map(|(lport,(en,lswitch))| (lport,lswitch))
                                                         .join_map(&(LPortBinding.map(|_x_| match _x_ {(lport,vport) => (lport,vport)})), |lport, lswitch, vport| (vport.clone(),(lport.clone(),lswitch.clone())))
                                                         .join_map(&(VSwitchPort.map(|_x_| match _x_ {(vport,__ph5,chassis,__ph6) => (vport,chassis)})), |vport, &(ref lport,ref lswitch), chassis| (chassis.clone(),lport.clone(),lswitch.clone()))
                                                         .map(|(chassis,lport,lswitch)| (lport.clone(),lswitch.clone(),chassis.clone(),false))));
            let LPortAtChassis = LPortAtChassis.concat(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortVIF{parent: _, tag_request: _, tag: _} => true, _ => false})
                                                                          .map(|_x_| match _x_ {(lport,lswitch,lport_type_t::LPortVIF{parent: p, tag_request: r, tag: t},__ph0,en,__ph1,__ph2,__ph3,__ph4) => (p,(en,lport,lswitch)), _ => unreachable!()})
                                                         .filter(|&(ref p, (ref en,ref lport,ref lswitch))| en.clone())
                                                         .join_map(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortVM => true, _ => false}).map(|_x_| match _x_ {(p,__ph5,lport_type_t::LPortVM{},__ph6,__ph7,__ph8,__ph9,__ph10,__ph11) => (p,()), _ => unreachable!()})), |p, &(ref en,ref lport,ref lswitch), &()| (p.clone(),(lport.clone(),lswitch.clone())))
                                                         .join_map(&(LPortBinding.map(|_x_| match _x_ {(p,vport) => (p,vport)})), |p, &(ref lport,ref lswitch), vport| (vport.clone(),(lport.clone(),lswitch.clone())))
                                                         .join_map(&(VSwitchPort.map(|_x_| match _x_ {(vport,__ph12,chassis,__ph13) => (vport,chassis)})), |vport, &(ref lport,ref lswitch), chassis| (chassis.clone(),lport.clone(),lswitch.clone()))
                                                         .map(|(chassis,lport,lswitch)| (lport.clone(),lswitch.clone(),chassis.clone(),false))));
            let LPortAtChassis = LPortAtChassis.concat(&(Chassis.map(|_x_| match _x_ {(chassis,f,__ph0,__ph1) => ((),(chassis,f))})
                                                         .filter(|&((), (ref chassis,ref f))| (f.clone() == false))
                                                         .join_map(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortLocalnet{localnet: _} => true, _ => false}).map(|_x_| match _x_ {(lport,lswitch,lport_type_t::LPortLocalnet{localnet: pnet},__ph2,en,__ph3,__ph4,__ph5,__ph6) => ((),(en,lport,lswitch)), _ => unreachable!()})), |&(), &(ref chassis,ref f), &(ref en,ref lport,ref lswitch)| (chassis.clone(),en.clone(),lport.clone(),lswitch.clone()))
                                                         .filter(|&(ref chassis,ref en,ref lport,ref lswitch)| en.clone())
                                                         .map(|(chassis,en,lport,lswitch)| (lport.clone(),lswitch.clone(),chassis.clone(),true))));
            let LPortAtChassis = LPortAtChassis.concat(&(Chassis.map(|_x_| match _x_ {(chassis,f,__ph0,__ph1) => ((),(chassis,f))})
                                                         .filter(|&((), (ref chassis,ref f))| (f.clone() == false))
                                                         .join_map(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortRouter{rport: _} => true, _ => false}).map(|_x_| match _x_ {(lport,lswitch,lport_type_t::LPortRouter{rport: __ph2},__ph3,en,__ph4,__ph5,__ph6,__ph7) => ((),(en,lport,lswitch)), _ => unreachable!()})), |&(), &(ref chassis,ref f), &(ref en,ref lport,ref lswitch)| (chassis.clone(),en.clone(),lport.clone(),lswitch.clone()))
                                                         .filter(|&(ref chassis,ref en,ref lport,ref lswitch)| en.clone())
                                                         .map(|(chassis,en,lport,lswitch)| (lport.clone(),lswitch.clone(),chassis.clone(),true))));
            let LPortAtChassis = LPortAtChassis.concat(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortL2Gateway{pnet: _, chassis: _} => true, _ => false})
                                                                          .map(|_x_| match _x_ {(lport,lswitch,lport_type_t::LPortL2Gateway{pnet: __ph0, chassis: chassis},__ph1,en,__ph2,__ph3,__ph4,__ph5) => (chassis,en,lport,lswitch), _ => unreachable!()})
                                                         .filter(|&(ref chassis,ref en,ref lport,ref lswitch)| en.clone())
                                                         .map(|(chassis,en,lport,lswitch)| (lport.clone(),lswitch.clone(),chassis.clone(),false))));
            let LPortAtChassis = LPortAtChassis.distinct();
            let (mut _LSwitchAtChassis, LSwitchAtChassis) = outer.new_collection::<(u32,u64,destination_t),isize>();
            let LSwitchAtChassis = LSwitchAtChassis.concat(&(Chassis.map(|_x_| match _x_ {(sender,f,__ph0,__ph1) => (sender,f)})
                                                             .filter(|&(ref sender, ref f)| (f.clone() == false))
                                                             .join_map(&(LPortAtChassis.map(|_x_| match _x_ {(__ph2,lswitch,sender,__ph3) => (sender,lswitch)})), |sender, f, lswitch| (lswitch.clone(),sender.clone()))
                                                             .map(|(lswitch,sender)| (sender.clone(),lswitch.clone(),destination_t::DSTLocal{}))));
            let LSwitchAtChassis = LSwitchAtChassis.concat(&(Chassis.map(|_x_| match _x_ {(sender,f,__ph0,__ph1) => ((),(f,sender))})
                                                             .filter(|&((), (ref f,ref sender))| (f.clone() == false))
                                                             .join_map(&(LPortAtChassis.map(|_x_| match _x_ {(__ph2,lswitch,chassis,fl) => ((),(chassis,fl,lswitch))})), |&(), &(ref f,ref sender), &(ref chassis,ref fl,ref lswitch)| (chassis.clone(),fl.clone(),lswitch.clone(),sender.clone()))
                                                             .filter(|&(ref chassis,ref fl,ref lswitch,ref sender)| ((!fl.clone()) && (chassis.clone() != sender.clone())))
                                                             .map(|(chassis,fl,lswitch,sender)| (sender.clone(),lswitch.clone(),destination_t::DSTChassis{chassis: chassis.clone()}))));
            let LSwitchAtChassis = LSwitchAtChassis.distinct();
            let (mut _LPortMACChassis, LPortMACChassis) = outer.new_collection::<(u64,u64,u64,u32,bool),isize>();
            let LPortMACChassis = LPortMACChassis.concat(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortVIF{parent: _, tag_request: _, tag: _} => true, _ => false})
                                                                            .map(|_x_| match _x_ {(lport,lswitch,lport_type_t::LPortVIF{parent: p, tag_request: r, tag: t},__ph0,en,__ph1,__ph2,__ph3,__ph4) => (p,(en,lport,lswitch)), _ => unreachable!()})
                                                           .filter(|&(ref p, (ref en,ref lport,ref lswitch))| en.clone())
                                                           .join_map(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortVM => true, _ => false}).map(|_x_| match _x_ {(p,__ph5,lport_type_t::LPortVM{},__ph6,__ph7,__ph8,__ph9,__ph10,__ph11) => (p,()), _ => unreachable!()})), |p, &(ref en,ref lport,ref lswitch), &()| (lport.clone(),(lswitch.clone(),p.clone())))
                                                           .join_map(&(LogicalSwitchPortMAC.map(|_x_| match _x_ {(lport,mac) => (lport,mac)})), |lport, &(ref lswitch,ref p), mac| (p.clone(),(lport.clone(),lswitch.clone(),mac.clone())))
                                                           .join_map(&(LPortBinding.map(|_x_| match _x_ {(p,vport) => (p,vport)})), |p, &(ref lport,ref lswitch,ref mac), vport| (vport.clone(),(lport.clone(),lswitch.clone(),mac.clone())))
                                                           .join_map(&(VSwitchPort.map(|_x_| match _x_ {(vport,__ph12,chassis,__ph13) => (vport,chassis)})), |vport, &(ref lport,ref lswitch,ref mac), chassis| (chassis.clone(),lport.clone(),lswitch.clone(),mac.clone()))
                                                           .map(|(chassis,lport,lswitch,mac)| (lswitch.clone(),lport.clone(),mac.clone(),chassis.clone(),false))));
            let LPortMACChassis = LPortMACChassis.concat(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortVM => true, _ => false})
                                                                            .map(|_x_| match _x_ {(lport,lswitch,lport_type_t::LPortVM{},__ph0,en,__ph1,__ph2,__ph3,__ph4) => (lport,(en,lswitch)), _ => unreachable!()})
                                                           .filter(|&(ref lport, (ref en,ref lswitch))| en.clone())
                                                           .join_map(&(LogicalSwitchPortMAC.map(|_x_| match _x_ {(lport,mac) => (lport,mac)})), |lport, &(ref en,ref lswitch), mac| (lport.clone(),(lswitch.clone(),mac.clone())))
                                                           .join_map(&(LPortBinding.map(|_x_| match _x_ {(lport,vport) => (lport,vport)})), |lport, &(ref lswitch,ref mac), vport| (vport.clone(),(lport.clone(),lswitch.clone(),mac.clone())))
                                                           .join_map(&(VSwitchPort.map(|_x_| match _x_ {(vport,__ph5,chassis,__ph6) => (vport,chassis)})), |vport, &(ref lport,ref lswitch,ref mac), chassis| (chassis.clone(),lport.clone(),lswitch.clone(),mac.clone()))
                                                           .map(|(chassis,lport,lswitch,mac)| (lswitch.clone(),lport.clone(),mac.clone(),chassis.clone(),false))));
            let LPortMACChassis = LPortMACChassis.concat(&(Chassis.map(|_x_| match _x_ {(chassis,f,__ph0,__ph1) => ((),(chassis,f))})
                                                           .filter(|&((), (ref chassis,ref f))| (f.clone() == false))
                                                           .join_map(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortLocalnet{localnet: _} => true, _ => false}).map(|_x_| match _x_ {(lport,lswitch,lport_type_t::LPortLocalnet{localnet: pnet},__ph2,en,__ph3,__ph4,__ph5,__ph6) => ((),(en,lport,lswitch)), _ => unreachable!()})), |&(), &(ref chassis,ref f), &(ref en,ref lport,ref lswitch)| (lport.clone(),(chassis.clone(),en.clone(),lswitch.clone())))
                                                           .filter(|&(ref lport, (ref chassis,ref en,ref lswitch))| en.clone())
                                                           .join_map(&(LogicalSwitchPortMAC.map(|_x_| match _x_ {(lport,mac) => (lport,mac)})), |lport, &(ref chassis,ref en,ref lswitch), mac| (chassis.clone(),lport.clone(),lswitch.clone(),mac.clone()))
                                                           .map(|(chassis,lport,lswitch,mac)| (lswitch.clone(),lport.clone(),mac.clone(),chassis.clone(),true))));
            let LPortMACChassis = LPortMACChassis.concat(&(Chassis.map(|_x_| match _x_ {(chassis,f,__ph0,__ph1) => ((),(chassis,f))})
                                                           .filter(|&((), (ref chassis,ref f))| (f.clone() == false))
                                                           .join_map(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortRouter{rport: _} => true, _ => false}).map(|_x_| match _x_ {(lport,lswitch,lport_type_t::LPortRouter{rport: r},__ph2,en,__ph3,__ph4,__ph5,__ph6) => ((),(en,lport,lswitch)), _ => unreachable!()})), |&(), &(ref chassis,ref f), &(ref en,ref lport,ref lswitch)| (lport.clone(),(chassis.clone(),en.clone(),lswitch.clone())))
                                                           .filter(|&(ref lport, (ref chassis,ref en,ref lswitch))| en.clone())
                                                           .join_map(&(LogicalSwitchPortMAC.map(|_x_| match _x_ {(lport,mac) => (lport,mac)})), |lport, &(ref chassis,ref en,ref lswitch), mac| (chassis.clone(),lport.clone(),lswitch.clone(),mac.clone()))
                                                           .map(|(chassis,lport,lswitch,mac)| (lswitch.clone(),lport.clone(),mac.clone(),chassis.clone(),true))));
            let LPortMACChassis = LPortMACChassis.concat(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortL2Gateway{pnet: _, chassis: _} => true, _ => false})
                                                                            .map(|_x_| match _x_ {(lport,lswitch,lport_type_t::LPortL2Gateway{pnet: pnet, chassis: chassis},__ph0,en,__ph1,__ph2,__ph3,__ph4) => (lport,(chassis,en,lswitch)), _ => unreachable!()})
                                                           .filter(|&(ref lport, (ref chassis,ref en,ref lswitch))| en.clone())
                                                           .join_map(&(LogicalSwitchPortMAC.map(|_x_| match _x_ {(lport,mac) => (lport,mac)})), |lport, &(ref chassis,ref en,ref lswitch), mac| (chassis.clone(),lport.clone(),lswitch.clone(),mac.clone()))
                                                           .map(|(chassis,lport,lswitch,mac)| (lswitch.clone(),lport.clone(),mac.clone(),chassis.clone(),false))));
            let LPortMACChassis = LPortMACChassis.distinct();
            let (mut _MACChassis, MACChassis) = outer.new_collection::<(u64,u64,destination_t),isize>();
            let MACChassis = MACChassis.concat(&(LPortMACChassis.map(|_x_| match _x_ {(lswitch,__ph0,mac,__ph1,f) => (f,lswitch,mac)})
                                                 .filter(|&(ref f,ref lswitch,ref mac)| f.clone())
                                                 .map(|(f,lswitch,mac)| (lswitch.clone(),mac.clone(),destination_t::DSTLocal{}))));
            let MACChassis = MACChassis.concat(&(LPortMACChassis.map(|_x_| match _x_ {(lswitch,__ph0,mac,chassis,f) => (chassis,f,lswitch,mac)})
                                                 .filter(|&(ref chassis,ref f,ref lswitch,ref mac)| (!f.clone()))
                                                 .map(|(chassis,f,lswitch,mac)| (lswitch.clone(),mac.clone(),destination_t::DSTChassis{chassis: chassis.clone()}))));
            let MACChassis = MACChassis.distinct();
            let (mut _LPortUnknownMACChassis, LPortUnknownMACChassis) = outer.new_collection::<(u64,u64,u32,bool),isize>();
            let LPortUnknownMACChassis = LPortUnknownMACChassis.concat(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortVIF{parent: _, tag_request: _, tag: _} => true, _ => false})
                                                                                          .map(|_x_| match _x_ {(lport,lswitch,lport_type_t::LPortVIF{parent: p, tag_request: r, tag: t},__ph0,en,__ph1,__ph2,u,__ph3) => (p,(en,lport,lswitch,u)), _ => unreachable!()})
                                                                         .filter(|&(ref p, (ref en,ref lport,ref lswitch,ref u))| (en.clone() && u.clone()))
                                                                         .join_map(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortVM => true, _ => false}).map(|_x_| match _x_ {(p,__ph4,lport_type_t::LPortVM{},__ph5,__ph6,__ph7,__ph8,__ph9,__ph10) => (p,()), _ => unreachable!()})), |p, &(ref en,ref lport,ref lswitch,ref u), &()| (lport.clone(),lswitch.clone()))
                                                                         .join_map(&(LPortBinding.map(|_x_| match _x_ {(lport,vport) => (lport,vport)})), |lport, lswitch, vport| (vport.clone(),(lport.clone(),lswitch.clone())))
                                                                         .join_map(&(VSwitchPort.map(|_x_| match _x_ {(vport,__ph11,chassis,__ph12) => (vport,chassis)})), |vport, &(ref lport,ref lswitch), chassis| (chassis.clone(),lport.clone(),lswitch.clone()))
                                                                         .map(|(chassis,lport,lswitch)| (lswitch.clone(),lport.clone(),chassis.clone(),false))));
            let LPortUnknownMACChassis = LPortUnknownMACChassis.concat(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortVM => true, _ => false})
                                                                                          .map(|_x_| match _x_ {(lport,lswitch,lport_type_t::LPortVM{},__ph0,en,__ph1,__ph2,u,__ph3) => (lport,(en,lswitch,u)), _ => unreachable!()})
                                                                         .filter(|&(ref lport, (ref en,ref lswitch,ref u))| (en.clone() && u.clone()))
                                                                         .antijoin(&(TrunkPort.map(|_x_| match _x_ {lport => lport})))
                                                                         .map(|(lport,(en,lswitch,u))| (lport,lswitch))
                                                                         .join_map(&(LPortBinding.map(|_x_| match _x_ {(lport,vport) => (lport,vport)})), |lport, lswitch, vport| (vport.clone(),(lport.clone(),lswitch.clone())))
                                                                         .join_map(&(VSwitchPort.map(|_x_| match _x_ {(vport,__ph4,chassis,__ph5) => (vport,chassis)})), |vport, &(ref lport,ref lswitch), chassis| (chassis.clone(),lport.clone(),lswitch.clone()))
                                                                         .map(|(chassis,lport,lswitch)| (lswitch.clone(),lport.clone(),chassis.clone(),false))));
            let LPortUnknownMACChassis = LPortUnknownMACChassis.concat(&(Chassis.map(|_x_| match _x_ {(sender,f,__ph0,__ph1) => ((),(f,sender))})
                                                                         .filter(|&((), (ref f,ref sender))| (f.clone() == false))
                                                                         .join_map(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortLocalnet{localnet: _} => true, _ => false}).map(|_x_| match _x_ {(lport,lswitch,lport_type_t::LPortLocalnet{localnet: pnet},__ph2,en,__ph3,__ph4,u,__ph5) => ((),(en,lport,lswitch,u)), _ => unreachable!()})), |&(), &(ref f,ref sender), &(ref en,ref lport,ref lswitch,ref u)| (en.clone(),lport.clone(),lswitch.clone(),sender.clone(),u.clone()))
                                                                         .filter(|&(ref en,ref lport,ref lswitch,ref sender,ref u)| (en.clone() && u.clone()))
                                                                         .map(|(en,lport,lswitch,sender,u)| (lport.clone(),lswitch.clone(),sender.clone(),true))));
            let LPortUnknownMACChassis = LPortUnknownMACChassis.concat(&(Chassis.map(|_x_| match _x_ {(sender,f,__ph0,__ph1) => ((),(f,sender))})
                                                                         .filter(|&((), (ref f,ref sender))| (f.clone() == false))
                                                                         .join_map(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortRouter{rport: _} => true, _ => false}).map(|_x_| match _x_ {(lport,lswitch,lport_type_t::LPortRouter{rport: r},__ph2,en,__ph3,__ph4,u,__ph5) => ((),(en,lport,lswitch,u)), _ => unreachable!()})), |&(), &(ref f,ref sender), &(ref en,ref lport,ref lswitch,ref u)| (en.clone(),lport.clone(),lswitch.clone(),sender.clone(),u.clone()))
                                                                         .filter(|&(ref en,ref lport,ref lswitch,ref sender,ref u)| (en.clone() && u.clone()))
                                                                         .map(|(en,lport,lswitch,sender,u)| (lport.clone(),lswitch.clone(),sender.clone(),true))));
            let LPortUnknownMACChassis = LPortUnknownMACChassis.concat(&(LogicalSwitchPort.filter(|&(ref id,ref lswitch,ref ptype,ref name,ref enabled,ref dhcp4_options,ref dhcp6_options,ref unknown_addr,ref ct_zone)| match ptype.clone() {lport_type_t::LPortL2Gateway{pnet: _, chassis: _} => true, _ => false})
                                                                                          .map(|_x_| match _x_ {(lport,lswitch,lport_type_t::LPortL2Gateway{pnet: pnet, chassis: chassis},__ph0,en,__ph1,__ph2,u,__ph3) => (chassis,en,lport,lswitch,u), _ => unreachable!()})
                                                                         .filter(|&(ref chassis,ref en,ref lport,ref lswitch,ref u)| (en.clone() && u.clone()))
                                                                         .map(|(chassis,en,lport,lswitch,u)| (lport.clone(),lswitch.clone(),chassis.clone(),false))));
            let LPortUnknownMACChassis = LPortUnknownMACChassis.distinct();
            let (mut _UnknownMACChassis, UnknownMACChassis) = outer.new_collection::<(u32,u64,destination_t),isize>();
            let UnknownMACChassis = UnknownMACChassis.concat(&(Chassis.map(|_x_| match _x_ {(sender,f,__ph0,__ph1) => (sender,f)})
                                                               .filter(|&(ref sender, ref f)| (f.clone() == false))
                                                               .join_map(&(LPortUnknownMACChassis.map(|_x_| match _x_ {(lswitch,__ph2,sender,__ph3) => (sender,lswitch)})), |sender, f, lswitch| (lswitch.clone(),sender.clone()))
                                                               .map(|(lswitch,sender)| (sender.clone(),lswitch.clone(),destination_t::DSTLocal{}))));
            let UnknownMACChassis = UnknownMACChassis.concat(&(Chassis.map(|_x_| match _x_ {(sender,f,__ph0,__ph1) => ((),(f,sender))})
                                                               .filter(|&((), (ref f,ref sender))| (f.clone() == false))
                                                               .join_map(&(LPortUnknownMACChassis.map(|_x_| match _x_ {(lswitch,__ph2,chassis,fl) => ((),(chassis,fl,lswitch))})), |&(), &(ref f,ref sender), &(ref chassis,ref fl,ref lswitch)| (chassis.clone(),fl.clone(),lswitch.clone(),sender.clone()))
                                                               .filter(|&(ref chassis,ref fl,ref lswitch,ref sender)| ((!fl.clone()) && (chassis.clone() != sender.clone())))
                                                               .map(|(chassis,fl,lswitch,sender)| (sender.clone(),lswitch.clone(),destination_t::DSTChassis{chassis: chassis.clone()}))));
            let UnknownMACChassis = UnknownMACChassis.distinct();
            let (mut _PortSecurityMAC, PortSecurityMAC) = outer.new_collection::<(u64,u64),isize>();
            let PortSecurityMAC = PortSecurityMAC.distinct();
            let (mut _PortSecurityEnabled, PortSecurityEnabled) = outer.new_collection::<u64,isize>();
            let PortSecurityEnabled = PortSecurityEnabled.concat(&(PortSecurityMAC.map(|_x_| match _x_ {(lport,__ph0) => lport})
                                                                   .map(|lport| lport.clone())));
            let PortSecurityEnabled = PortSecurityEnabled.distinct();
            let (mut _PortSecurityIP, PortSecurityIP) = outer.new_collection::<(u64,u64,ip_subnet_t),isize>();
            let PortSecurityIP = PortSecurityIP.distinct();
            let (mut _PortIPSecurityEnabled, PortIPSecurityEnabled) = outer.new_collection::<u64,isize>();
            let PortIPSecurityEnabled = PortIPSecurityEnabled.concat(&(PortSecurityMAC.map(|_x_| match _x_ {(lport,mac) => ((lport,mac),())})
                                                                       .join_map(&(PortSecurityIP.map(|_x_| match _x_ {(lport,mac,__ph0) => ((lport,mac),())})), |&(ref lport,ref mac), &(), &()| lport.clone())
                                                                       .map(|lport| lport.clone())));
            let PortIPSecurityEnabled = PortIPSecurityEnabled.distinct();
            let (mut _PortSecurityType, PortSecurityType) = outer.new_collection::<(u64,port_sec_type_t),isize>();
            let PortSecurityType = PortSecurityType.concat(&(PortIPSecurityEnabled.map(|_x_| match _x_ {lport => lport})
                                                             .map(|lport| (lport.clone(),port_sec_type_t::PortSecIP{}))));
            let PortSecurityType = PortSecurityType.concat(&(PortSecurityEnabled.map(|_x_| match _x_ {lport => (lport,())})
                                                             .antijoin(&(PortIPSecurityEnabled.map(|_x_| match _x_ {lport => lport})))
                                                             .map(|(lport,())| lport)
                                                             .map(|lport| (lport.clone(),port_sec_type_t::PortSecMAC{}))));
            let PortSecurityType = PortSecurityType.concat(&(LogicalSwitchPort.map(|_x_| match _x_ {(lport,__ph0,__ph1,__ph2,__ph3,__ph4,__ph5,__ph6,__ph7) => (lport,())})
                                                             .antijoin(&(PortSecurityEnabled.map(|_x_| match _x_ {lport => lport})))
                                                             .map(|(lport,())| lport)
                                                             .map(|lport| (lport.clone(),port_sec_type_t::PortSecNone{}))));
            let PortSecurityType = PortSecurityType.distinct();
            let (mut _PortSecurityIP4Match, PortSecurityIP4Match) = outer.new_collection::<(u64,u64,ip4_subnet_t),isize>();
            let PortSecurityIP4Match = PortSecurityIP4Match.concat(&(PortSecurityMAC.map(|_x_| match _x_ {(lport,mac) => ((lport,mac),())})
                                                                     .join_map(&(PortSecurityIP.filter(|&(ref lport,ref mac,ref subnet)| match subnet.clone() {ip_subnet_t::IPSubnet4{ip4_subnet: _} => true, _ => false}).map(|_x_| match _x_ {(lport,mac,ip_subnet_t::IPSubnet4{ip4_subnet: subnet}) => ((lport,mac),subnet), _ => unreachable!()})), |&(ref lport,ref mac), &(), subnet| (lport.clone(),mac.clone(),subnet.clone()))
                                                                     .map(|(lport,mac,subnet)| (lport.clone(),mac.clone(),subnet.clone()))));
            let PortSecurityIP4Match = PortSecurityIP4Match.concat(&(PortSecurityMAC.map(|_x_| match _x_ {(lport,mac) => (lport,mac)})
                                                                     .antijoin(&(PortIPSecurityEnabled.map(|_x_| match _x_ {lport => lport})))
                                                                     .map(|(lport,mac)| (lport,mac))
                                                                     .map(|(lport,mac)| (lport.clone(),mac.clone(),ip4_subnet_t::IP4Subnet{addr: 0, mask: 0}))));
            let PortSecurityIP4Match = PortSecurityIP4Match.distinct();
            let (mut _PortSecurityIP6Match, PortSecurityIP6Match) = outer.new_collection::<(u64,u64,ip6_subnet_t),isize>();
            let PortSecurityIP6Match = PortSecurityIP6Match.concat(&(PortSecurityMAC.map(|_x_| match _x_ {(lport,mac) => ((lport,mac),())})
                                                                     .join_map(&(PortSecurityIP.filter(|&(ref lport,ref mac,ref subnet)| match subnet.clone() {ip_subnet_t::IPSubnet6{ip6_subnet: _} => true, _ => false}).map(|_x_| match _x_ {(lport,mac,ip_subnet_t::IPSubnet6{ip6_subnet: subnet}) => ((lport,mac),subnet), _ => unreachable!()})), |&(ref lport,ref mac), &(), subnet| (lport.clone(),mac.clone(),subnet.clone()))
                                                                     .map(|(lport,mac,subnet)| (lport.clone(),mac.clone(),subnet.clone()))));
            let PortSecurityIP6Match = PortSecurityIP6Match.concat(&(PortSecurityMAC.map(|_x_| match _x_ {(lport,mac) => (lport,mac)})
                                                                     .antijoin(&(PortIPSecurityEnabled.map(|_x_| match _x_ {lport => lport})))
                                                                     .map(|(lport,mac)| (lport,mac))
                                                                     .map(|(lport,mac)| (lport.clone(),mac.clone(),ip6_subnet_t::IP6Subnet{addr: Uint::parse_bytes(b"0", 10), mask: Uint::parse_bytes(b"0", 10)}))));
            let PortSecurityIP6Match = PortSecurityIP6Match.distinct();
            let (mut _AddressSet, AddressSet) = outer.new_collection::<(u64,String),isize>();
            let AddressSet = AddressSet.distinct();
            let (mut _AddressSetAddr, AddressSetAddr) = outer.new_collection::<(u64,ip_subnet_t),isize>();
            let AddressSetAddr = AddressSetAddr.distinct();
            let (mut _LoadBalancer, LoadBalancer) = outer.new_collection::<(u64,String,u8),isize>();
            let LoadBalancer = LoadBalancer.distinct();
            let (mut _LBSwitch, LBSwitch) = outer.new_collection::<(u64,u64),isize>();
            let LBSwitch = LBSwitch.distinct();
            let (mut _LBVIP, LBVIP) = outer.new_collection::<(u64,ip4_addr_port_t),isize>();
            let LBVIP = LBVIP.distinct();
            let (mut _LPortLBVIP, LPortLBVIP) = outer.new_collection::<(u64,ip4_addr_port_t),isize>();
            let LPortLBVIP = LPortLBVIP.concat(&(LogicalSwitchPort.map(|_x_| match _x_ {(lport,lswitch,__ph0,__ph1,__ph2,__ph3,__ph4,__ph5,__ph6) => (lswitch,lport)})
                                                 .join_map(&(LBSwitch.map(|_x_| match _x_ {(lb,lswitch) => (lswitch,lb)})), |lswitch, lport, lb| (lb.clone(),lport.clone()))
                                                 .join_map(&(LBVIP.map(|_x_| match _x_ {(lb,vip) => (lb,vip)})), |lb, lport, vip| (lport.clone(),vip.clone()))
                                                 .map(|(lport,vip)| (lport.clone(),vip.clone()))));
            let LPortLBVIP = LPortLBVIP.distinct();
            let (mut _LPortLB, LPortLB) = outer.new_collection::<u64,isize>();
            let LPortLB = LPortLB.concat(&(LPortLBVIP.map(|_x_| match _x_ {(lport,__ph0) => lport})
                                           .map(|lport| lport.clone())));
            let LPortLB = LPortLB.distinct();
            let (mut _LBIP, LBIP) = outer.new_collection::<(u64,ip4_addr_port_t,ip4_addr_port_t),isize>();
            let LBIP = LBIP.distinct();
            let (mut _LPortLBVIPIP, LPortLBVIPIP) = outer.new_collection::<(u64,u8,ip4_addr_port_t,ip4_addr_port_t),isize>();
            let LPortLBVIPIP = LPortLBVIPIP.concat(&(LogicalSwitchPort.map(|_x_| match _x_ {(lport,lswitch,__ph0,__ph1,__ph2,__ph3,__ph4,__ph5,__ph6) => ((),(lport,lswitch))})
                                                     .join_map(&(LoadBalancer.map(|_x_| match _x_ {(lb,__ph7,proto) => ((),(lb,proto))})), |&(), &(ref lport,ref lswitch), &(ref lb,ref proto)| ((lb.clone(),lswitch.clone()),(lport.clone(),proto.clone())))
                                                     .join_map(&(LBSwitch.map(|_x_| match _x_ {(lb,lswitch) => ((lb,lswitch),())})), |&(ref lb,ref lswitch), &(ref lport,ref proto), &()| (lb.clone(),(lport.clone(),proto.clone())))
                                                     .join_map(&(LBIP.map(|_x_| match _x_ {(lb,vip,ip) => (lb,(ip,vip))})), |lb, &(ref lport,ref proto), &(ref ip,ref vip)| (ip.clone(),lport.clone(),proto.clone(),vip.clone()))
                                                     .map(|(ip,lport,proto,vip)| (lport.clone(),proto.clone(),vip.clone(),ip.clone()))));
            let LPortLBVIPIP = LPortLBVIPIP.distinct();
            let (mut _ACL, ACL) = outer.new_collection::<(u64,u16,acl_dir_t,__lambda,acl_action_t),isize>();
            let ACL = ACL.distinct();
            let (mut _LPortStatefulACL, LPortStatefulACL) = outer.new_collection::<u64,isize>();
            let LPortStatefulACL = LPortStatefulACL.concat(&(LogicalSwitchPort.map(|_x_| match _x_ {(lport,lswitch,__ph0,__ph1,__ph2,__ph3,__ph4,__ph5,__ph6) => (lswitch,lport)})
                                                             .join_map(&(ACL.filter(|&(ref lswitch,ref priority,ref direction,ref match_cond,ref action)| match action.clone() {acl_action_t::ACLAllow => true, _ => false}).map(|_x_| match _x_ {(lswitch,__ph7,__ph8,__ph9,acl_action_t::ACLAllow{}) => (lswitch,()), _ => unreachable!()})), |lswitch, lport, &()| lport.clone())
                                                             .map(|lport| lport.clone())));
            let LPortStatefulACL = LPortStatefulACL.concat(&(LogicalSwitchPort.map(|_x_| match _x_ {(lport,lswitch,__ph0,__ph1,__ph2,__ph3,__ph4,__ph5,__ph6) => (lswitch,lport)})
                                                             .join_map(&(ACL.filter(|&(ref lswitch,ref priority,ref direction,ref match_cond,ref action)| match action.clone() {acl_action_t::ACLAllowRelated => true, _ => false}).map(|_x_| match _x_ {(lswitch,__ph7,__ph8,__ph9,acl_action_t::ACLAllowRelated{}) => (lswitch,()), _ => unreachable!()})), |lswitch, lport, &()| lport.clone())
                                                             .map(|lport| lport.clone())));
            let LPortStatefulACL = LPortStatefulACL.distinct();
            let (mut _LBRouter, LBRouter) = outer.new_collection::<(u64,u64),isize>();
            let LBRouter = LBRouter.distinct();
            let (mut _LRouterLBVIP, LRouterLBVIP) = outer.new_collection::<(u64,u32),isize>();
            let LRouterLBVIP = LRouterLBVIP.concat(&(LBRouter.map(|_x_| match _x_ {(lb,lrouter) => (lb,lrouter)})
                                                     .join_map(&(LBVIP.map(|_x_| match _x_ {(lb,ip4_addr_port_t::IP4AddrPort{addr: vip, prt: __ph0}) => (lb,vip)})), |lb, lrouter, vip| (lrouter.clone(),vip.clone()))
                                                     .map(|(lrouter,vip)| (lrouter.clone(),vip.clone()))));
            let LRouterLBVIP = LRouterLBVIP.distinct();
            let (mut _LRouterPortNetwork, LRouterPortNetwork) = outer.new_collection::<(u32,ip_subnet_t),isize>();
            let LRouterPortNetwork = LRouterPortNetwork.distinct();
            let (mut _LRouterNetwork, LRouterNetwork) = outer.new_collection::<(u64,ip_subnet_t),isize>();
            let LRouterNetwork = LRouterNetwork.concat(&(LogicalRouterPort.map(|_x_| match _x_ {(lrport,__ph0,lrouter,__ph1,__ph2,__ph3,__ph4,__ph5) => (lrport,lrouter)})
                                                         .join_map(&(LRouterPortNetwork.map(|_x_| match _x_ {(lrport,network) => (lrport,network)})), |lrport, lrouter, network| (lrouter.clone(),network.clone()))
                                                         .map(|(lrouter,network)| (lrouter.clone(),network.clone()))));
            let LRouterNetwork = LRouterNetwork.distinct();
            let (mut _LogicalRouterStaticRoute, LogicalRouterStaticRoute) = outer.new_collection::<(u64,ip_subnet_t,ip_addr_t,u32),isize>();
            let LogicalRouterStaticRoute = LogicalRouterStaticRoute.distinct();
            let (mut _Route, Route) = outer.new_collection::<(u64,ip_subnet_t,opt_ip_addr_t,u32,u64,ip_addr_t),isize>();
            let Route = Route.concat(&(LogicalRouterStaticRoute.map(|_x_| match _x_ {(lrouter,ip_prefix,nexthop,outport) => (outport,(ip_prefix,lrouter,nexthop))})
                                       .join_map(&(LogicalRouterPort.map(|_x_| match _x_ {(outport,__ph0,__ph1,__ph2,outportmac,__ph3,__ph4,__ph5) => (outport,outportmac)})), |outport, &(ref ip_prefix,ref lrouter,ref nexthop), outportmac| (outport.clone(),(ip_prefix.clone(),lrouter.clone(),nexthop.clone(),outportmac.clone())))
                                       .join_map(&(LRouterPortNetwork.filter(|&(ref lport,ref network)| match network.clone() {ip_subnet_t::IPSubnet6{ip6_subnet: _} => true, _ => false}).map(|_x_| match _x_ {(outport,ip_subnet_t::IPSubnet6{ip6_subnet: ip6_subnet_t::IP6Subnet{addr: _sn6_addr, mask: _sn6_mask}}) => (outport,_sn6_addr), _ => unreachable!()})), |outport, &(ref ip_prefix,ref lrouter,ref nexthop,ref outportmac), _sn6_addr| (_sn6_addr.clone(),ip_prefix.clone(),lrouter.clone(),nexthop.clone(),outport.clone(),outportmac.clone()))
                                       .map(|(_sn6_addr,ip_prefix,lrouter,nexthop,outport,outportmac)| (lrouter.clone(),ip_prefix.clone(),opt_ip_addr_t::SomeIPAddr{addr: nexthop.clone()},outport.clone(),outportmac.clone(),ip_addr_t::IPAddr6{addr6: _sn6_addr.clone()}))));
            let Route = Route.concat(&(LogicalRouterStaticRoute.map(|_x_| match _x_ {(lrouter,ip_prefix,nexthop,outport) => (outport,(ip_prefix,lrouter,nexthop))})
                                       .join_map(&(LogicalRouterPort.map(|_x_| match _x_ {(outport,__ph0,__ph1,__ph2,outportmac,__ph3,__ph4,__ph5) => (outport,outportmac)})), |outport, &(ref ip_prefix,ref lrouter,ref nexthop), outportmac| (outport.clone(),(ip_prefix.clone(),lrouter.clone(),nexthop.clone(),outportmac.clone())))
                                       .join_map(&(LRouterPortNetwork.filter(|&(ref lport,ref network)| match network.clone() {ip_subnet_t::IPSubnet4{ip4_subnet: _} => true, _ => false}).map(|_x_| match _x_ {(outport,ip_subnet_t::IPSubnet4{ip4_subnet: ip4_subnet_t::IP4Subnet{addr: _sn4_addr, mask: _sn4_mask}}) => (outport,_sn4_addr), _ => unreachable!()})), |outport, &(ref ip_prefix,ref lrouter,ref nexthop,ref outportmac), _sn4_addr| (_sn4_addr.clone(),ip_prefix.clone(),lrouter.clone(),nexthop.clone(),outport.clone(),outportmac.clone()))
                                       .map(|(_sn4_addr,ip_prefix,lrouter,nexthop,outport,outportmac)| (lrouter.clone(),ip_prefix.clone(),opt_ip_addr_t::SomeIPAddr{addr: nexthop.clone()},outport.clone(),outportmac.clone(),ip_addr_t::IPAddr4{addr4: _sn4_addr.clone()}))));
            let Route = Route.concat(&(LRouterPortNetwork.filter(|&(ref lport,ref network)| match network.clone() {ip_subnet_t::IPSubnet6{ip6_subnet: _} => true, _ => false})
                                                         .map(|_x_| match _x_ {(outport,ip_subnet_t::IPSubnet6{ip6_subnet: ip6_subnet_t::IP6Subnet{addr: _sn6_addr, mask: _sn6_mask}}) => (outport,(_sn6_addr,_sn6_mask)), _ => unreachable!()})
                                       .join_map(&(LogicalRouterPort.map(|_x_| match _x_ {(outport,__ph0,lrouter,__ph1,outportmac,e,__ph2,__ph3) => (outport,(e,lrouter,outportmac))})), |outport, &(ref _sn6_addr,ref _sn6_mask), &(ref e,ref lrouter,ref outportmac)| (_sn6_addr.clone(),_sn6_mask.clone(),e.clone(),lrouter.clone(),outport.clone(),outportmac.clone()))
                                       .filter(|&(ref _sn6_addr,ref _sn6_mask,ref e,ref lrouter,ref outport,ref outportmac)| e.clone())
                                       .map(|(_sn6_addr,_sn6_mask,e,lrouter,outport,outportmac)| (lrouter.clone(),ip_subnet_t::IPSubnet6{ip6_subnet: ip6_subnet_t::IP6Subnet{addr: _sn6_addr.clone(), mask: _sn6_mask.clone()}},opt_ip_addr_t::NoIPAddr{},outport.clone(),outportmac.clone(),ip_addr_t::IPAddr6{addr6: _sn6_addr.clone()}))));
            let Route = Route.concat(&(LRouterPortNetwork.filter(|&(ref lport,ref network)| match network.clone() {ip_subnet_t::IPSubnet4{ip4_subnet: _} => true, _ => false})
                                                         .map(|_x_| match _x_ {(outport,ip_subnet_t::IPSubnet4{ip4_subnet: ip4_subnet_t::IP4Subnet{addr: _sn4_addr, mask: _sn4_mask}}) => (outport,(_sn4_addr,_sn4_mask)), _ => unreachable!()})
                                       .join_map(&(LogicalRouterPort.map(|_x_| match _x_ {(outport,__ph0,lrouter,__ph1,outportmac,e,__ph2,__ph3) => (outport,(e,lrouter,outportmac))})), |outport, &(ref _sn4_addr,ref _sn4_mask), &(ref e,ref lrouter,ref outportmac)| (_sn4_addr.clone(),_sn4_mask.clone(),e.clone(),lrouter.clone(),outport.clone(),outportmac.clone()))
                                       .filter(|&(ref _sn4_addr,ref _sn4_mask,ref e,ref lrouter,ref outport,ref outportmac)| e.clone())
                                       .map(|(_sn4_addr,_sn4_mask,e,lrouter,outport,outportmac)| (lrouter.clone(),ip_subnet_t::IPSubnet4{ip4_subnet: ip4_subnet_t::IP4Subnet{addr: _sn4_addr.clone(), mask: _sn4_mask.clone()}},opt_ip_addr_t::NoIPAddr{},outport.clone(),outportmac.clone(),ip_addr_t::IPAddr4{addr4: _sn4_addr.clone()}))));
            let Route = Route.distinct();
            let (mut _NAT, NAT) = outer.new_collection::<(u64,nat_type_t,u32,opt_mac_addr_t,ip4_subnet_t,opt_lport_id_t),isize>();
            let NAT = NAT.distinct();
            let (mut _NATChassis, NATChassis) = outer.new_collection::<(u64,nat_type_t,u32,opt_mac_addr_t,ip4_subnet_t,u64,u32),isize>();
            let NATChassis = NATChassis.concat(&(NAT.filter(|&(ref lrouter,ref ntype,ref external_ip,ref external_mac,ref logical_ip,ref logical_port)| match external_mac.clone() {opt_mac_addr_t::NoMACAddr => true, _ => false} && match logical_port.clone() {opt_lport_id_t::SomeLPortId{id: _} => true, _ => false})
                                                    .map(|_x_| match _x_ {(lrouter,ntype,external_ip,opt_mac_addr_t::NoMACAddr{},logical_ip,opt_lport_id_t::SomeLPortId{id: logical_port}) => (lrouter,(external_ip,logical_ip,ntype)), _ => unreachable!()})
                                                 .join_map(&(LogicalRouterPort.filter(|&(ref id,ref name,ref lrouter,ref ptype,ref mac,ref enabled,ref peer,ref ct_zone)| match ptype.clone() {lrouter_port_type_t::LRPGateway{redirectChassis: _} => true, _ => false}).map(|_x_| match _x_ {(__ph0,__ph1,lrouter,lrouter_port_type_t::LRPGateway{redirectChassis: chassis},__ph2,e,__ph3,__ph4) => (lrouter,(chassis,e)), _ => unreachable!()})), |lrouter, &(ref external_ip,ref logical_ip,ref ntype), &(ref chassis,ref e)| (chassis.clone(),e.clone(),external_ip.clone(),logical_ip.clone(),lrouter.clone(),ntype.clone()))
                                                 .filter(|&(ref chassis,ref e,ref external_ip,ref logical_ip,ref lrouter,ref ntype)| e.clone())
                                                 .map(|(chassis,e,external_ip,logical_ip,lrouter,ntype)| (lrouter.clone(),ntype.clone(),external_ip.clone(),opt_mac_addr_t::NoMACAddr{},logical_ip.clone(),0,chassis.clone()))));
            let NATChassis = NATChassis.concat(&(NAT.filter(|&(ref lrouter,ref ntype,ref external_ip,ref external_mac,ref logical_ip,ref logical_port)| match external_mac.clone() {opt_mac_addr_t::SomeMACAddr{addr: _} => true, _ => false} && match logical_port.clone() {opt_lport_id_t::SomeLPortId{id: _} => true, _ => false})
                                                    .map(|_x_| match _x_ {(lrouter,ntype,external_ip,opt_mac_addr_t::SomeMACAddr{addr: external_mac},logical_ip,opt_lport_id_t::SomeLPortId{id: logical_port}) => (logical_port,(external_ip,external_mac,logical_ip,lrouter,ntype)), _ => unreachable!()})
                                                 .join_map(&(LPortAtChassis.map(|_x_| match _x_ {(logical_port,__ph0,chassis,f) => (logical_port,(chassis,f))})), |logical_port, &(ref external_ip,ref external_mac,ref logical_ip,ref lrouter,ref ntype), &(ref chassis,ref f)| (chassis.clone(),external_ip.clone(),external_mac.clone(),f.clone(),logical_ip.clone(),logical_port.clone(),lrouter.clone(),ntype.clone()))
                                                 .filter(|&(ref chassis,ref external_ip,ref external_mac,ref f,ref logical_ip,ref logical_port,ref lrouter,ref ntype)| (!f.clone()))
                                                 .map(|(chassis,external_ip,external_mac,f,logical_ip,logical_port,lrouter,ntype)| (lrouter.clone(),ntype.clone(),external_ip.clone(),opt_mac_addr_t::SomeMACAddr{addr: external_mac.clone()},logical_ip.clone(),logical_port.clone(),chassis.clone()))));
            let NATChassis = NATChassis.distinct();
            let (mut _LearnedAddress, LearnedAddress) = outer.new_collection::<(u32,ip_addr_t,u64),isize>();
            let LearnedAddress = LearnedAddress.distinct();
            let (mut _TunnelPort, TunnelPort) = outer.new_collection::<(u64,u16,u32,u32),isize>();
            let TunnelPort = TunnelPort.distinct();
            let (mut _TunnelFromTo, TunnelFromTo) = outer.new_collection::<(u32,u32,u32),isize>();
            let TunnelFromTo = TunnelFromTo.concat(&(TunnelPort.map(|_x_| match _x_ {(__ph0,__ph1,to,toip) => ((),(to,toip))})
                                                     .join_map(&(Chassis.map(|_x_| match _x_ {(from,__ph2,__ph3,__ph4) => ((),from)})), |&(), &(ref to,ref toip), from| (from.clone(),to.clone(),toip.clone()))
                                                     .filter(|&(ref from,ref to,ref toip)| (from.clone() != to.clone()))
                                                     .map(|(from,to,toip)| (from.clone(),to.clone(),toip.clone()))));
            let TunnelFromTo = TunnelFromTo.distinct();
            let (mut __realized_VSwitchPort, _realized_VSwitchPort) = outer.new_collection::<(u64,String,u32,u16),isize>();
            let _realized_VSwitchPort = _realized_VSwitchPort.distinct();
            let (mut __delta_VSwitchPort, _delta_VSwitchPort) = outer.new_collection::<(bool,u64,String,u32,u16),isize>();
            let _delta_VSwitchPort = _delta_VSwitchPort.concat(&(_realized_VSwitchPort.map(|_x_| match _x_ {(id,name,switch,portnum) => ((id,name,portnum,switch),())})
                                                                 .antijoin(&(VSwitchPort.map(|_x_| match _x_ {(id,name,switch,portnum) => (id,name,portnum,switch)})))
                                                                 .map(|((id,name,portnum,switch),())| (id,name,portnum,switch))
                                                                 .map(|(id,name,portnum,switch)| (false,id.clone(),name.clone(),switch.clone(),portnum.clone()))));
            let _delta_VSwitchPort = _delta_VSwitchPort.concat(&(VSwitchPort.map(|_x_| match _x_ {(id,name,switch,portnum) => ((id,name,portnum,switch),())})
                                                                 .antijoin(&(_realized_VSwitchPort.map(|_x_| match _x_ {(id,name,switch,portnum) => (id,name,portnum,switch)})))
                                                                 .map(|((id,name,portnum,switch),())| (id,name,portnum,switch))
                                                                 .map(|(id,name,portnum,switch)| (true,id.clone(),name.clone(),switch.clone(),portnum.clone()))));
            let _delta_VSwitchPort = _delta_VSwitchPort.distinct();
            let (mut __realized_LPortBinding, _realized_LPortBinding) = outer.new_collection::<(u64,u64),isize>();
            let _realized_LPortBinding = _realized_LPortBinding.distinct();
            let (mut __delta_LPortBinding, _delta_LPortBinding) = outer.new_collection::<(bool,u64,u64),isize>();
            let _delta_LPortBinding = _delta_LPortBinding.concat(&(_realized_LPortBinding.map(|_x_| match _x_ {(lport,vport) => ((lport,vport),())})
                                                                   .antijoin(&(LPortBinding.map(|_x_| match _x_ {(lport,vport) => (lport,vport)})))
                                                                   .map(|((lport,vport),())| (lport,vport))
                                                                   .map(|(lport,vport)| (false,lport.clone(),vport.clone()))));
            let _delta_LPortBinding = _delta_LPortBinding.concat(&(LPortBinding.map(|_x_| match _x_ {(lport,vport) => ((lport,vport),())})
                                                                   .antijoin(&(_realized_LPortBinding.map(|_x_| match _x_ {(lport,vport) => (lport,vport)})))
                                                                   .map(|((lport,vport),())| (lport,vport))
                                                                   .map(|(lport,vport)| (true,lport.clone(),vport.clone()))));
            let _delta_LPortBinding = _delta_LPortBinding.distinct();
            let (mut __realized_LogicalSwitchPort, _realized_LogicalSwitchPort) = outer.new_collection::<(u64,u64,lport_type_t,String,bool,opt_dhcp4_options_id_t,opt_dhcp6_options_id_t,bool,u16),isize>();
            let _realized_LogicalSwitchPort = _realized_LogicalSwitchPort.distinct();
            let (mut __delta_LogicalSwitchPort, _delta_LogicalSwitchPort) = outer.new_collection::<(bool,u64,u64,lport_type_t,String,bool,opt_dhcp4_options_id_t,opt_dhcp6_options_id_t,bool,u16),isize>();
            let _delta_LogicalSwitchPort = _delta_LogicalSwitchPort.concat(&(_realized_LogicalSwitchPort.map(|_x_| match _x_ {(id,lswitch,ptype,name,enabled,dhcp4_options,dhcp6_options,unknown_addr,ct_zone) => ((ct_zone,dhcp4_options,dhcp6_options,enabled,id,lswitch,name,ptype,unknown_addr),())})
                                                                             .antijoin(&(LogicalSwitchPort.map(|_x_| match _x_ {(id,lswitch,ptype,name,enabled,dhcp4_options,dhcp6_options,unknown_addr,ct_zone) => (ct_zone,dhcp4_options,dhcp6_options,enabled,id,lswitch,name,ptype,unknown_addr)})))
                                                                             .map(|((ct_zone,dhcp4_options,dhcp6_options,enabled,id,lswitch,name,ptype,unknown_addr),())| (ct_zone,dhcp4_options,dhcp6_options,enabled,id,lswitch,name,ptype,unknown_addr))
                                                                             .map(|(ct_zone,dhcp4_options,dhcp6_options,enabled,id,lswitch,name,ptype,unknown_addr)| (false,id.clone(),lswitch.clone(),ptype.clone(),name.clone(),enabled.clone(),dhcp4_options.clone(),dhcp6_options.clone(),unknown_addr.clone(),ct_zone.clone()))));
            let _delta_LogicalSwitchPort = _delta_LogicalSwitchPort.concat(&(LogicalSwitchPort.map(|_x_| match _x_ {(id,lswitch,ptype,name,enabled,dhcp4_options,dhcp6_options,unknown_addr,ct_zone) => ((ct_zone,dhcp4_options,dhcp6_options,enabled,id,lswitch,name,ptype,unknown_addr),())})
                                                                             .antijoin(&(_realized_LogicalSwitchPort.map(|_x_| match _x_ {(id,lswitch,ptype,name,enabled,dhcp4_options,dhcp6_options,unknown_addr,ct_zone) => (ct_zone,dhcp4_options,dhcp6_options,enabled,id,lswitch,name,ptype,unknown_addr)})))
                                                                             .map(|((ct_zone,dhcp4_options,dhcp6_options,enabled,id,lswitch,name,ptype,unknown_addr),())| (ct_zone,dhcp4_options,dhcp6_options,enabled,id,lswitch,name,ptype,unknown_addr))
                                                                             .map(|(ct_zone,dhcp4_options,dhcp6_options,enabled,id,lswitch,name,ptype,unknown_addr)| (true,id.clone(),lswitch.clone(),ptype.clone(),name.clone(),enabled.clone(),dhcp4_options.clone(),dhcp6_options.clone(),unknown_addr.clone(),ct_zone.clone()))));
            let _delta_LogicalSwitchPort = _delta_LogicalSwitchPort.distinct();
            let (mut __realized_PortSecurityType, _realized_PortSecurityType) = outer.new_collection::<(u64,port_sec_type_t),isize>();
            let _realized_PortSecurityType = _realized_PortSecurityType.distinct();
            let (mut __delta_PortSecurityType, _delta_PortSecurityType) = outer.new_collection::<(bool,u64,port_sec_type_t),isize>();
            let _delta_PortSecurityType = _delta_PortSecurityType.concat(&(_realized_PortSecurityType.map(|_x_| match _x_ {(lport,stype) => ((lport,stype),())})
                                                                           .antijoin(&(PortSecurityType.map(|_x_| match _x_ {(lport,stype) => (lport,stype)})))
                                                                           .map(|((lport,stype),())| (lport,stype))
                                                                           .map(|(lport,stype)| (false,lport.clone(),stype.clone()))));
            let _delta_PortSecurityType = _delta_PortSecurityType.concat(&(PortSecurityType.map(|_x_| match _x_ {(lport,stype) => ((lport,stype),())})
                                                                           .antijoin(&(_realized_PortSecurityType.map(|_x_| match _x_ {(lport,stype) => (lport,stype)})))
                                                                           .map(|((lport,stype),())| (lport,stype))
                                                                           .map(|(lport,stype)| (true,lport.clone(),stype.clone()))));
            let _delta_PortSecurityType = _delta_PortSecurityType.distinct();
            let (mut __realized_PortSecurityMAC, _realized_PortSecurityMAC) = outer.new_collection::<(u64,u64),isize>();
            let _realized_PortSecurityMAC = _realized_PortSecurityMAC.distinct();
            let (mut __delta_PortSecurityMAC, _delta_PortSecurityMAC) = outer.new_collection::<(bool,u64,u64),isize>();
            let _delta_PortSecurityMAC = _delta_PortSecurityMAC.concat(&(_realized_PortSecurityMAC.map(|_x_| match _x_ {(lport,mac) => ((lport,mac),())})
                                                                         .antijoin(&(PortSecurityMAC.map(|_x_| match _x_ {(lport,mac) => (lport,mac)})))
                                                                         .map(|((lport,mac),())| (lport,mac))
                                                                         .map(|(lport,mac)| (false,lport.clone(),mac.clone()))));
            let _delta_PortSecurityMAC = _delta_PortSecurityMAC.concat(&(PortSecurityMAC.map(|_x_| match _x_ {(lport,mac) => ((lport,mac),())})
                                                                         .antijoin(&(_realized_PortSecurityMAC.map(|_x_| match _x_ {(lport,mac) => (lport,mac)})))
                                                                         .map(|((lport,mac),())| (lport,mac))
                                                                         .map(|(lport,mac)| (true,lport.clone(),mac.clone()))));
            let _delta_PortSecurityMAC = _delta_PortSecurityMAC.distinct();
            let (mut __realized_LPortStatefulACL, _realized_LPortStatefulACL) = outer.new_collection::<u64,isize>();
            let _realized_LPortStatefulACL = _realized_LPortStatefulACL.distinct();
            let (mut __delta_LPortStatefulACL, _delta_LPortStatefulACL) = outer.new_collection::<(bool,u64),isize>();
            let _delta_LPortStatefulACL = _delta_LPortStatefulACL.concat(&(_realized_LPortStatefulACL.map(|_x_| match _x_ {lport => (lport,())})
                                                                           .antijoin(&(LPortStatefulACL.map(|_x_| match _x_ {lport => lport})))
                                                                           .map(|(lport,())| lport)
                                                                           .map(|lport| (false,lport.clone()))));
            let _delta_LPortStatefulACL = _delta_LPortStatefulACL.concat(&(LPortStatefulACL.map(|_x_| match _x_ {lport => (lport,())})
                                                                           .antijoin(&(_realized_LPortStatefulACL.map(|_x_| match _x_ {lport => lport})))
                                                                           .map(|(lport,())| lport)
                                                                           .map(|lport| (true,lport.clone()))));
            let _delta_LPortStatefulACL = _delta_LPortStatefulACL.distinct();
            let (mut __realized_LPortLBVIP, _realized_LPortLBVIP) = outer.new_collection::<(u64,ip4_addr_port_t),isize>();
            let _realized_LPortLBVIP = _realized_LPortLBVIP.distinct();
            let (mut __delta_LPortLBVIP, _delta_LPortLBVIP) = outer.new_collection::<(bool,u64,ip4_addr_port_t),isize>();
            let _delta_LPortLBVIP = _delta_LPortLBVIP.concat(&(_realized_LPortLBVIP.map(|_x_| match _x_ {(lport,vip) => ((lport,vip),())})
                                                               .antijoin(&(LPortLBVIP.map(|_x_| match _x_ {(lport,vip) => (lport,vip)})))
                                                               .map(|((lport,vip),())| (lport,vip))
                                                               .map(|(lport,vip)| (false,lport.clone(),vip.clone()))));
            let _delta_LPortLBVIP = _delta_LPortLBVIP.concat(&(LPortLBVIP.map(|_x_| match _x_ {(lport,vip) => ((lport,vip),())})
                                                               .antijoin(&(_realized_LPortLBVIP.map(|_x_| match _x_ {(lport,vip) => (lport,vip)})))
                                                               .map(|((lport,vip),())| (lport,vip))
                                                               .map(|(lport,vip)| (true,lport.clone(),vip.clone()))));
            let _delta_LPortLBVIP = _delta_LPortLBVIP.distinct();
            let (mut __realized_ACL, _realized_ACL) = outer.new_collection::<(u64,u16,acl_dir_t,__lambda,acl_action_t),isize>();
            let _realized_ACL = _realized_ACL.distinct();
            let (mut __delta_ACL, _delta_ACL) = outer.new_collection::<(bool,u64,u16,acl_dir_t,__lambda,acl_action_t),isize>();
            let _delta_ACL = _delta_ACL.concat(&(_realized_ACL.map(|_x_| match _x_ {(lswitch,priority,direction,match_cond,action) => ((action,direction,lswitch,match_cond,priority),())})
                                                 .antijoin(&(ACL.map(|_x_| match _x_ {(lswitch,priority,direction,match_cond,action) => (action,direction,lswitch,match_cond,priority)})))
                                                 .map(|((action,direction,lswitch,match_cond,priority),())| (action,direction,lswitch,match_cond,priority))
                                                 .map(|(action,direction,lswitch,match_cond,priority)| (false,lswitch.clone(),priority.clone(),direction.clone(),match_cond.clone(),action.clone()))));
            let _delta_ACL = _delta_ACL.concat(&(ACL.map(|_x_| match _x_ {(lswitch,priority,direction,match_cond,action) => ((action,direction,lswitch,match_cond,priority),())})
                                                 .antijoin(&(_realized_ACL.map(|_x_| match _x_ {(lswitch,priority,direction,match_cond,action) => (action,direction,lswitch,match_cond,priority)})))
                                                 .map(|((action,direction,lswitch,match_cond,priority),())| (action,direction,lswitch,match_cond,priority))
                                                 .map(|(action,direction,lswitch,match_cond,priority)| (true,lswitch.clone(),priority.clone(),direction.clone(),match_cond.clone(),action.clone()))));
            let _delta_ACL = _delta_ACL.distinct();
            let (mut __realized_LPortLBVIPIP, _realized_LPortLBVIPIP) = outer.new_collection::<(u64,u8,ip4_addr_port_t,ip4_addr_port_t),isize>();
            let _realized_LPortLBVIPIP = _realized_LPortLBVIPIP.distinct();
            let (mut __delta_LPortLBVIPIP, _delta_LPortLBVIPIP) = outer.new_collection::<(bool,u64,u8,ip4_addr_port_t,ip4_addr_port_t),isize>();
            let _delta_LPortLBVIPIP = _delta_LPortLBVIPIP.concat(&(_realized_LPortLBVIPIP.map(|_x_| match _x_ {(lport,proto,vip,ip) => ((ip,lport,proto,vip),())})
                                                                   .antijoin(&(LPortLBVIPIP.map(|_x_| match _x_ {(lport,proto,vip,ip) => (ip,lport,proto,vip)})))
                                                                   .map(|((ip,lport,proto,vip),())| (ip,lport,proto,vip))
                                                                   .map(|(ip,lport,proto,vip)| (false,lport.clone(),proto.clone(),vip.clone(),ip.clone()))));
            let _delta_LPortLBVIPIP = _delta_LPortLBVIPIP.concat(&(LPortLBVIPIP.map(|_x_| match _x_ {(lport,proto,vip,ip) => ((ip,lport,proto,vip),())})
                                                                   .antijoin(&(_realized_LPortLBVIPIP.map(|_x_| match _x_ {(lport,proto,vip,ip) => (ip,lport,proto,vip)})))
                                                                   .map(|((ip,lport,proto,vip),())| (ip,lport,proto,vip))
                                                                   .map(|(ip,lport,proto,vip)| (true,lport.clone(),proto.clone(),vip.clone(),ip.clone()))));
            let _delta_LPortLBVIPIP = _delta_LPortLBVIPIP.distinct();
            let (mut __realized_LPortMACIP, _realized_LPortMACIP) = outer.new_collection::<(u64,u64,u64,ip_addr_t),isize>();
            let _realized_LPortMACIP = _realized_LPortMACIP.distinct();
            let (mut __delta_LPortMACIP, _delta_LPortMACIP) = outer.new_collection::<(bool,u64,u64,u64,ip_addr_t),isize>();
            let _delta_LPortMACIP = _delta_LPortMACIP.concat(&(_realized_LPortMACIP.map(|_x_| match _x_ {(lswitch,lport,mac,ip) => ((ip,lport,lswitch,mac),())})
                                                               .antijoin(&(LPortMACIP.map(|_x_| match _x_ {(lswitch,lport,mac,ip) => (ip,lport,lswitch,mac)})))
                                                               .map(|((ip,lport,lswitch,mac),())| (ip,lport,lswitch,mac))
                                                               .map(|(ip,lport,lswitch,mac)| (false,lswitch.clone(),lport.clone(),mac.clone(),ip.clone()))));
            let _delta_LPortMACIP = _delta_LPortMACIP.concat(&(LPortMACIP.map(|_x_| match _x_ {(lswitch,lport,mac,ip) => ((ip,lport,lswitch,mac),())})
                                                               .antijoin(&(_realized_LPortMACIP.map(|_x_| match _x_ {(lswitch,lport,mac,ip) => (ip,lport,lswitch,mac)})))
                                                               .map(|((ip,lport,lswitch,mac),())| (ip,lport,lswitch,mac))
                                                               .map(|(ip,lport,lswitch,mac)| (true,lswitch.clone(),lport.clone(),mac.clone(),ip.clone()))));
            let _delta_LPortMACIP = _delta_LPortMACIP.distinct();
            let (mut __realized_LPortDHCP4AddrOpts, _realized_LPortDHCP4AddrOpts) = outer.new_collection::<(u64,u64,u32,dhcp4_options_t),isize>();
            let _realized_LPortDHCP4AddrOpts = _realized_LPortDHCP4AddrOpts.distinct();
            let (mut __delta_LPortDHCP4AddrOpts, _delta_LPortDHCP4AddrOpts) = outer.new_collection::<(bool,u64,u64,u32,dhcp4_options_t),isize>();
            let _delta_LPortDHCP4AddrOpts = _delta_LPortDHCP4AddrOpts.concat(&(_realized_LPortDHCP4AddrOpts.map(|_x_| match _x_ {(lport,mac,ip,options) => ((ip,lport,mac,options),())})
                                                                               .antijoin(&(LPortDHCP4AddrOpts.map(|_x_| match _x_ {(lport,mac,ip,options) => (ip,lport,mac,options)})))
                                                                               .map(|((ip,lport,mac,options),())| (ip,lport,mac,options))
                                                                               .map(|(ip,lport,mac,options)| (false,lport.clone(),mac.clone(),ip.clone(),options.clone()))));
            let _delta_LPortDHCP4AddrOpts = _delta_LPortDHCP4AddrOpts.concat(&(LPortDHCP4AddrOpts.map(|_x_| match _x_ {(lport,mac,ip,options) => ((ip,lport,mac,options),())})
                                                                               .antijoin(&(_realized_LPortDHCP4AddrOpts.map(|_x_| match _x_ {(lport,mac,ip,options) => (ip,lport,mac,options)})))
                                                                               .map(|((ip,lport,mac,options),())| (ip,lport,mac,options))
                                                                               .map(|(ip,lport,mac,options)| (true,lport.clone(),mac.clone(),ip.clone(),options.clone()))));
            let _delta_LPortDHCP4AddrOpts = _delta_LPortDHCP4AddrOpts.distinct();
            let (mut __realized_LPortDHCP6AddrOpts, _realized_LPortDHCP6AddrOpts) = outer.new_collection::<(u64,u64,Uint,Uint,dhcp6_options_t),isize>();
            let _realized_LPortDHCP6AddrOpts = _realized_LPortDHCP6AddrOpts.distinct();
            let (mut __delta_LPortDHCP6AddrOpts, _delta_LPortDHCP6AddrOpts) = outer.new_collection::<(bool,u64,u64,Uint,Uint,dhcp6_options_t),isize>();
            let _delta_LPortDHCP6AddrOpts = _delta_LPortDHCP6AddrOpts.concat(&(_realized_LPortDHCP6AddrOpts.map(|_x_| match _x_ {(lport,mac,ip,server_ip,options) => ((ip,lport,mac,options,server_ip),())})
                                                                               .antijoin(&(LPortDHCP6AddrOpts.map(|_x_| match _x_ {(lport,mac,ip,server_ip,options) => (ip,lport,mac,options,server_ip)})))
                                                                               .map(|((ip,lport,mac,options,server_ip),())| (ip,lport,mac,options,server_ip))
                                                                               .map(|(ip,lport,mac,options,server_ip)| (false,lport.clone(),mac.clone(),ip.clone(),server_ip.clone(),options.clone()))));
            let _delta_LPortDHCP6AddrOpts = _delta_LPortDHCP6AddrOpts.concat(&(LPortDHCP6AddrOpts.map(|_x_| match _x_ {(lport,mac,ip,server_ip,options) => ((ip,lport,mac,options,server_ip),())})
                                                                               .antijoin(&(_realized_LPortDHCP6AddrOpts.map(|_x_| match _x_ {(lport,mac,ip,server_ip,options) => (ip,lport,mac,options,server_ip)})))
                                                                               .map(|((ip,lport,mac,options,server_ip),())| (ip,lport,mac,options,server_ip))
                                                                               .map(|(ip,lport,mac,options,server_ip)| (true,lport.clone(),mac.clone(),ip.clone(),server_ip.clone(),options.clone()))));
            let _delta_LPortDHCP6AddrOpts = _delta_LPortDHCP6AddrOpts.distinct();
            let (mut __realized_LSwitchAtChassis, _realized_LSwitchAtChassis) = outer.new_collection::<(u32,u64,destination_t),isize>();
            let _realized_LSwitchAtChassis = _realized_LSwitchAtChassis.distinct();
            let (mut __delta_LSwitchAtChassis, _delta_LSwitchAtChassis) = outer.new_collection::<(bool,u32,u64,destination_t),isize>();
            let _delta_LSwitchAtChassis = _delta_LSwitchAtChassis.concat(&(_realized_LSwitchAtChassis.map(|_x_| match _x_ {(sender,lswitch,chassis) => ((chassis,lswitch,sender),())})
                                                                           .antijoin(&(LSwitchAtChassis.map(|_x_| match _x_ {(sender,lswitch,chassis) => (chassis,lswitch,sender)})))
                                                                           .map(|((chassis,lswitch,sender),())| (chassis,lswitch,sender))
                                                                           .map(|(chassis,lswitch,sender)| (false,sender.clone(),lswitch.clone(),chassis.clone()))));
            let _delta_LSwitchAtChassis = _delta_LSwitchAtChassis.concat(&(LSwitchAtChassis.map(|_x_| match _x_ {(sender,lswitch,chassis) => ((chassis,lswitch,sender),())})
                                                                           .antijoin(&(_realized_LSwitchAtChassis.map(|_x_| match _x_ {(sender,lswitch,chassis) => (chassis,lswitch,sender)})))
                                                                           .map(|((chassis,lswitch,sender),())| (chassis,lswitch,sender))
                                                                           .map(|(chassis,lswitch,sender)| (true,sender.clone(),lswitch.clone(),chassis.clone()))));
            let _delta_LSwitchAtChassis = _delta_LSwitchAtChassis.distinct();
            let (mut __realized_MACChassis, _realized_MACChassis) = outer.new_collection::<(u64,u64,destination_t),isize>();
            let _realized_MACChassis = _realized_MACChassis.distinct();
            let (mut __delta_MACChassis, _delta_MACChassis) = outer.new_collection::<(bool,u64,u64,destination_t),isize>();
            let _delta_MACChassis = _delta_MACChassis.concat(&(_realized_MACChassis.map(|_x_| match _x_ {(lswitch,mac,chassis) => ((chassis,lswitch,mac),())})
                                                               .antijoin(&(MACChassis.map(|_x_| match _x_ {(lswitch,mac,chassis) => (chassis,lswitch,mac)})))
                                                               .map(|((chassis,lswitch,mac),())| (chassis,lswitch,mac))
                                                               .map(|(chassis,lswitch,mac)| (false,lswitch.clone(),mac.clone(),chassis.clone()))));
            let _delta_MACChassis = _delta_MACChassis.concat(&(MACChassis.map(|_x_| match _x_ {(lswitch,mac,chassis) => ((chassis,lswitch,mac),())})
                                                               .antijoin(&(_realized_MACChassis.map(|_x_| match _x_ {(lswitch,mac,chassis) => (chassis,lswitch,mac)})))
                                                               .map(|((chassis,lswitch,mac),())| (chassis,lswitch,mac))
                                                               .map(|(chassis,lswitch,mac)| (true,lswitch.clone(),mac.clone(),chassis.clone()))));
            let _delta_MACChassis = _delta_MACChassis.distinct();
            let (mut __realized_UnknownMACChassis, _realized_UnknownMACChassis) = outer.new_collection::<(u32,u64,destination_t),isize>();
            let _realized_UnknownMACChassis = _realized_UnknownMACChassis.distinct();
            let (mut __delta_UnknownMACChassis, _delta_UnknownMACChassis) = outer.new_collection::<(bool,u32,u64,destination_t),isize>();
            let _delta_UnknownMACChassis = _delta_UnknownMACChassis.concat(&(_realized_UnknownMACChassis.map(|_x_| match _x_ {(sender,lswitch,chassis) => ((chassis,lswitch,sender),())})
                                                                             .antijoin(&(UnknownMACChassis.map(|_x_| match _x_ {(sender,lswitch,chassis) => (chassis,lswitch,sender)})))
                                                                             .map(|((chassis,lswitch,sender),())| (chassis,lswitch,sender))
                                                                             .map(|(chassis,lswitch,sender)| (false,sender.clone(),lswitch.clone(),chassis.clone()))));
            let _delta_UnknownMACChassis = _delta_UnknownMACChassis.concat(&(UnknownMACChassis.map(|_x_| match _x_ {(sender,lswitch,chassis) => ((chassis,lswitch,sender),())})
                                                                             .antijoin(&(_realized_UnknownMACChassis.map(|_x_| match _x_ {(sender,lswitch,chassis) => (chassis,lswitch,sender)})))
                                                                             .map(|((chassis,lswitch,sender),())| (chassis,lswitch,sender))
                                                                             .map(|(chassis,lswitch,sender)| (true,sender.clone(),lswitch.clone(),chassis.clone()))));
            let _delta_UnknownMACChassis = _delta_UnknownMACChassis.distinct();
            let (mut __realized_PortSecurityIP4Match, _realized_PortSecurityIP4Match) = outer.new_collection::<(u64,u64,ip4_subnet_t),isize>();
            let _realized_PortSecurityIP4Match = _realized_PortSecurityIP4Match.distinct();
            let (mut __delta_PortSecurityIP4Match, _delta_PortSecurityIP4Match) = outer.new_collection::<(bool,u64,u64,ip4_subnet_t),isize>();
            let _delta_PortSecurityIP4Match = _delta_PortSecurityIP4Match.concat(&(_realized_PortSecurityIP4Match.map(|_x_| match _x_ {(lport,mac,subnet) => ((lport,mac,subnet),())})
                                                                                   .antijoin(&(PortSecurityIP4Match.map(|_x_| match _x_ {(lport,mac,subnet) => (lport,mac,subnet)})))
                                                                                   .map(|((lport,mac,subnet),())| (lport,mac,subnet))
                                                                                   .map(|(lport,mac,subnet)| (false,lport.clone(),mac.clone(),subnet.clone()))));
            let _delta_PortSecurityIP4Match = _delta_PortSecurityIP4Match.concat(&(PortSecurityIP4Match.map(|_x_| match _x_ {(lport,mac,subnet) => ((lport,mac,subnet),())})
                                                                                   .antijoin(&(_realized_PortSecurityIP4Match.map(|_x_| match _x_ {(lport,mac,subnet) => (lport,mac,subnet)})))
                                                                                   .map(|((lport,mac,subnet),())| (lport,mac,subnet))
                                                                                   .map(|(lport,mac,subnet)| (true,lport.clone(),mac.clone(),subnet.clone()))));
            let _delta_PortSecurityIP4Match = _delta_PortSecurityIP4Match.distinct();
            let (mut __realized_PortSecurityIP, _realized_PortSecurityIP) = outer.new_collection::<(u64,u64,ip_subnet_t),isize>();
            let _realized_PortSecurityIP = _realized_PortSecurityIP.distinct();
            let (mut __delta_PortSecurityIP, _delta_PortSecurityIP) = outer.new_collection::<(bool,u64,u64,ip_subnet_t),isize>();
            let _delta_PortSecurityIP = _delta_PortSecurityIP.concat(&(_realized_PortSecurityIP.map(|_x_| match _x_ {(lport,mac,subnet) => ((lport,mac,subnet),())})
                                                                       .antijoin(&(PortSecurityIP.map(|_x_| match _x_ {(lport,mac,subnet) => (lport,mac,subnet)})))
                                                                       .map(|((lport,mac,subnet),())| (lport,mac,subnet))
                                                                       .map(|(lport,mac,subnet)| (false,lport.clone(),mac.clone(),subnet.clone()))));
            let _delta_PortSecurityIP = _delta_PortSecurityIP.concat(&(PortSecurityIP.map(|_x_| match _x_ {(lport,mac,subnet) => ((lport,mac,subnet),())})
                                                                       .antijoin(&(_realized_PortSecurityIP.map(|_x_| match _x_ {(lport,mac,subnet) => (lport,mac,subnet)})))
                                                                       .map(|((lport,mac,subnet),())| (lport,mac,subnet))
                                                                       .map(|(lport,mac,subnet)| (true,lport.clone(),mac.clone(),subnet.clone()))));
            let _delta_PortSecurityIP = _delta_PortSecurityIP.distinct();
            let (mut __realized_PortSecurityIP6Match, _realized_PortSecurityIP6Match) = outer.new_collection::<(u64,u64,ip6_subnet_t),isize>();
            let _realized_PortSecurityIP6Match = _realized_PortSecurityIP6Match.distinct();
            let (mut __delta_PortSecurityIP6Match, _delta_PortSecurityIP6Match) = outer.new_collection::<(bool,u64,u64,ip6_subnet_t),isize>();
            let _delta_PortSecurityIP6Match = _delta_PortSecurityIP6Match.concat(&(_realized_PortSecurityIP6Match.map(|_x_| match _x_ {(lport,mac,subnet) => ((lport,mac,subnet),())})
                                                                                   .antijoin(&(PortSecurityIP6Match.map(|_x_| match _x_ {(lport,mac,subnet) => (lport,mac,subnet)})))
                                                                                   .map(|((lport,mac,subnet),())| (lport,mac,subnet))
                                                                                   .map(|(lport,mac,subnet)| (false,lport.clone(),mac.clone(),subnet.clone()))));
            let _delta_PortSecurityIP6Match = _delta_PortSecurityIP6Match.concat(&(PortSecurityIP6Match.map(|_x_| match _x_ {(lport,mac,subnet) => ((lport,mac,subnet),())})
                                                                                   .antijoin(&(_realized_PortSecurityIP6Match.map(|_x_| match _x_ {(lport,mac,subnet) => (lport,mac,subnet)})))
                                                                                   .map(|((lport,mac,subnet),())| (lport,mac,subnet))
                                                                                   .map(|(lport,mac,subnet)| (true,lport.clone(),mac.clone(),subnet.clone()))));
            let _delta_PortSecurityIP6Match = _delta_PortSecurityIP6Match.distinct();
            let (mut __realized_LogicalRouterPort, _realized_LogicalRouterPort) = outer.new_collection::<(u32,String,u64,lrouter_port_type_t,u64,bool,opt_peer_t,u16),isize>();
            let _realized_LogicalRouterPort = _realized_LogicalRouterPort.distinct();
            let (mut __delta_LogicalRouterPort, _delta_LogicalRouterPort) = outer.new_collection::<(bool,u32,String,u64,lrouter_port_type_t,u64,bool,opt_peer_t,u16),isize>();
            let _delta_LogicalRouterPort = _delta_LogicalRouterPort.concat(&(_realized_LogicalRouterPort.map(|_x_| match _x_ {(id,name,lrouter,ptype,mac,enabled,peer,ct_zone) => ((ct_zone,enabled,id,lrouter,mac,name,peer,ptype),())})
                                                                             .antijoin(&(LogicalRouterPort.map(|_x_| match _x_ {(id,name,lrouter,ptype,mac,enabled,peer,ct_zone) => (ct_zone,enabled,id,lrouter,mac,name,peer,ptype)})))
                                                                             .map(|((ct_zone,enabled,id,lrouter,mac,name,peer,ptype),())| (ct_zone,enabled,id,lrouter,mac,name,peer,ptype))
                                                                             .map(|(ct_zone,enabled,id,lrouter,mac,name,peer,ptype)| (false,id.clone(),name.clone(),lrouter.clone(),ptype.clone(),mac.clone(),enabled.clone(),peer.clone(),ct_zone.clone()))));
            let _delta_LogicalRouterPort = _delta_LogicalRouterPort.concat(&(LogicalRouterPort.map(|_x_| match _x_ {(id,name,lrouter,ptype,mac,enabled,peer,ct_zone) => ((ct_zone,enabled,id,lrouter,mac,name,peer,ptype),())})
                                                                             .antijoin(&(_realized_LogicalRouterPort.map(|_x_| match _x_ {(id,name,lrouter,ptype,mac,enabled,peer,ct_zone) => (ct_zone,enabled,id,lrouter,mac,name,peer,ptype)})))
                                                                             .map(|((ct_zone,enabled,id,lrouter,mac,name,peer,ptype),())| (ct_zone,enabled,id,lrouter,mac,name,peer,ptype))
                                                                             .map(|(ct_zone,enabled,id,lrouter,mac,name,peer,ptype)| (true,id.clone(),name.clone(),lrouter.clone(),ptype.clone(),mac.clone(),enabled.clone(),peer.clone(),ct_zone.clone()))));
            let _delta_LogicalRouterPort = _delta_LogicalRouterPort.distinct();
            let (mut __realized_NATChassis, _realized_NATChassis) = outer.new_collection::<(u64,nat_type_t,u32,opt_mac_addr_t,ip4_subnet_t,u64,u32),isize>();
            let _realized_NATChassis = _realized_NATChassis.distinct();
            let (mut __delta_NATChassis, _delta_NATChassis) = outer.new_collection::<(bool,u64,nat_type_t,u32,opt_mac_addr_t,ip4_subnet_t,u64,u32),isize>();
            let _delta_NATChassis = _delta_NATChassis.concat(&(_realized_NATChassis.map(|_x_| match _x_ {(lrouter,ntype,external_ip,external_mac,logical_ip,logical_port,chassis) => ((chassis,external_ip,external_mac,logical_ip,logical_port,lrouter,ntype),())})
                                                               .antijoin(&(NATChassis.map(|_x_| match _x_ {(lrouter,ntype,external_ip,external_mac,logical_ip,logical_port,chassis) => (chassis,external_ip,external_mac,logical_ip,logical_port,lrouter,ntype)})))
                                                               .map(|((chassis,external_ip,external_mac,logical_ip,logical_port,lrouter,ntype),())| (chassis,external_ip,external_mac,logical_ip,logical_port,lrouter,ntype))
                                                               .map(|(chassis,external_ip,external_mac,logical_ip,logical_port,lrouter,ntype)| (false,lrouter.clone(),ntype.clone(),external_ip.clone(),external_mac.clone(),logical_ip.clone(),logical_port.clone(),chassis.clone()))));
            let _delta_NATChassis = _delta_NATChassis.concat(&(NATChassis.map(|_x_| match _x_ {(lrouter,ntype,external_ip,external_mac,logical_ip,logical_port,chassis) => ((chassis,external_ip,external_mac,logical_ip,logical_port,lrouter,ntype),())})
                                                               .antijoin(&(_realized_NATChassis.map(|_x_| match _x_ {(lrouter,ntype,external_ip,external_mac,logical_ip,logical_port,chassis) => (chassis,external_ip,external_mac,logical_ip,logical_port,lrouter,ntype)})))
                                                               .map(|((chassis,external_ip,external_mac,logical_ip,logical_port,lrouter,ntype),())| (chassis,external_ip,external_mac,logical_ip,logical_port,lrouter,ntype))
                                                               .map(|(chassis,external_ip,external_mac,logical_ip,logical_port,lrouter,ntype)| (true,lrouter.clone(),ntype.clone(),external_ip.clone(),external_mac.clone(),logical_ip.clone(),logical_port.clone(),chassis.clone()))));
            let _delta_NATChassis = _delta_NATChassis.distinct();
            let (mut __realized_LRouterNetwork, _realized_LRouterNetwork) = outer.new_collection::<(u64,ip_subnet_t),isize>();
            let _realized_LRouterNetwork = _realized_LRouterNetwork.distinct();
            let (mut __delta_LRouterNetwork, _delta_LRouterNetwork) = outer.new_collection::<(bool,u64,ip_subnet_t),isize>();
            let _delta_LRouterNetwork = _delta_LRouterNetwork.concat(&(_realized_LRouterNetwork.map(|_x_| match _x_ {(lrouter,network) => ((lrouter,network),())})
                                                                       .antijoin(&(LRouterNetwork.map(|_x_| match _x_ {(lrouter,network) => (lrouter,network)})))
                                                                       .map(|((lrouter,network),())| (lrouter,network))
                                                                       .map(|(lrouter,network)| (false,lrouter.clone(),network.clone()))));
            let _delta_LRouterNetwork = _delta_LRouterNetwork.concat(&(LRouterNetwork.map(|_x_| match _x_ {(lrouter,network) => ((lrouter,network),())})
                                                                       .antijoin(&(_realized_LRouterNetwork.map(|_x_| match _x_ {(lrouter,network) => (lrouter,network)})))
                                                                       .map(|((lrouter,network),())| (lrouter,network))
                                                                       .map(|(lrouter,network)| (true,lrouter.clone(),network.clone()))));
            let _delta_LRouterNetwork = _delta_LRouterNetwork.distinct();
            let (mut __realized_LRouterPortNetwork, _realized_LRouterPortNetwork) = outer.new_collection::<(u32,ip_subnet_t),isize>();
            let _realized_LRouterPortNetwork = _realized_LRouterPortNetwork.distinct();
            let (mut __delta_LRouterPortNetwork, _delta_LRouterPortNetwork) = outer.new_collection::<(bool,u32,ip_subnet_t),isize>();
            let _delta_LRouterPortNetwork = _delta_LRouterPortNetwork.concat(&(_realized_LRouterPortNetwork.map(|_x_| match _x_ {(lport,network) => ((lport,network),())})
                                                                               .antijoin(&(LRouterPortNetwork.map(|_x_| match _x_ {(lport,network) => (lport,network)})))
                                                                               .map(|((lport,network),())| (lport,network))
                                                                               .map(|(lport,network)| (false,lport.clone(),network.clone()))));
            let _delta_LRouterPortNetwork = _delta_LRouterPortNetwork.concat(&(LRouterPortNetwork.map(|_x_| match _x_ {(lport,network) => ((lport,network),())})
                                                                               .antijoin(&(_realized_LRouterPortNetwork.map(|_x_| match _x_ {(lport,network) => (lport,network)})))
                                                                               .map(|((lport,network),())| (lport,network))
                                                                               .map(|(lport,network)| (true,lport.clone(),network.clone()))));
            let _delta_LRouterPortNetwork = _delta_LRouterPortNetwork.distinct();
            let (mut __realized_LRouterLBVIP, _realized_LRouterLBVIP) = outer.new_collection::<(u64,u32),isize>();
            let _realized_LRouterLBVIP = _realized_LRouterLBVIP.distinct();
            let (mut __delta_LRouterLBVIP, _delta_LRouterLBVIP) = outer.new_collection::<(bool,u64,u32),isize>();
            let _delta_LRouterLBVIP = _delta_LRouterLBVIP.concat(&(_realized_LRouterLBVIP.map(|_x_| match _x_ {(lrouter,vip) => ((lrouter,vip),())})
                                                                   .antijoin(&(LRouterLBVIP.map(|_x_| match _x_ {(lrouter,vip) => (lrouter,vip)})))
                                                                   .map(|((lrouter,vip),())| (lrouter,vip))
                                                                   .map(|(lrouter,vip)| (false,lrouter.clone(),vip.clone()))));
            let _delta_LRouterLBVIP = _delta_LRouterLBVIP.concat(&(LRouterLBVIP.map(|_x_| match _x_ {(lrouter,vip) => ((lrouter,vip),())})
                                                                   .antijoin(&(_realized_LRouterLBVIP.map(|_x_| match _x_ {(lrouter,vip) => (lrouter,vip)})))
                                                                   .map(|((lrouter,vip),())| (lrouter,vip))
                                                                   .map(|(lrouter,vip)| (true,lrouter.clone(),vip.clone()))));
            let _delta_LRouterLBVIP = _delta_LRouterLBVIP.distinct();
            let (mut __realized_NAT, _realized_NAT) = outer.new_collection::<(u64,nat_type_t,u32,opt_mac_addr_t,ip4_subnet_t,opt_lport_id_t),isize>();
            let _realized_NAT = _realized_NAT.distinct();
            let (mut __delta_NAT, _delta_NAT) = outer.new_collection::<(bool,u64,nat_type_t,u32,opt_mac_addr_t,ip4_subnet_t,opt_lport_id_t),isize>();
            let _delta_NAT = _delta_NAT.concat(&(_realized_NAT.map(|_x_| match _x_ {(lrouter,ntype,external_ip,external_mac,logical_ip,logical_port) => ((external_ip,external_mac,logical_ip,logical_port,lrouter,ntype),())})
                                                 .antijoin(&(NAT.map(|_x_| match _x_ {(lrouter,ntype,external_ip,external_mac,logical_ip,logical_port) => (external_ip,external_mac,logical_ip,logical_port,lrouter,ntype)})))
                                                 .map(|((external_ip,external_mac,logical_ip,logical_port,lrouter,ntype),())| (external_ip,external_mac,logical_ip,logical_port,lrouter,ntype))
                                                 .map(|(external_ip,external_mac,logical_ip,logical_port,lrouter,ntype)| (false,lrouter.clone(),ntype.clone(),external_ip.clone(),external_mac.clone(),logical_ip.clone(),logical_port.clone()))));
            let _delta_NAT = _delta_NAT.concat(&(NAT.map(|_x_| match _x_ {(lrouter,ntype,external_ip,external_mac,logical_ip,logical_port) => ((external_ip,external_mac,logical_ip,logical_port,lrouter,ntype),())})
                                                 .antijoin(&(_realized_NAT.map(|_x_| match _x_ {(lrouter,ntype,external_ip,external_mac,logical_ip,logical_port) => (external_ip,external_mac,logical_ip,logical_port,lrouter,ntype)})))
                                                 .map(|((external_ip,external_mac,logical_ip,logical_port,lrouter,ntype),())| (external_ip,external_mac,logical_ip,logical_port,lrouter,ntype))
                                                 .map(|(external_ip,external_mac,logical_ip,logical_port,lrouter,ntype)| (true,lrouter.clone(),ntype.clone(),external_ip.clone(),external_mac.clone(),logical_ip.clone(),logical_port.clone()))));
            let _delta_NAT = _delta_NAT.distinct();
            let (mut __realized_LearnedAddress, _realized_LearnedAddress) = outer.new_collection::<(u32,ip_addr_t,u64),isize>();
            let _realized_LearnedAddress = _realized_LearnedAddress.distinct();
            let (mut __delta_LearnedAddress, _delta_LearnedAddress) = outer.new_collection::<(bool,u32,ip_addr_t,u64),isize>();
            let _delta_LearnedAddress = _delta_LearnedAddress.concat(&(_realized_LearnedAddress.map(|_x_| match _x_ {(rport,ip,mac) => ((ip,mac,rport),())})
                                                                       .antijoin(&(LearnedAddress.map(|_x_| match _x_ {(rport,ip,mac) => (ip,mac,rport)})))
                                                                       .map(|((ip,mac,rport),())| (ip,mac,rport))
                                                                       .map(|(ip,mac,rport)| (false,rport.clone(),ip.clone(),mac.clone()))));
            let _delta_LearnedAddress = _delta_LearnedAddress.concat(&(LearnedAddress.map(|_x_| match _x_ {(rport,ip,mac) => ((ip,mac,rport),())})
                                                                       .antijoin(&(_realized_LearnedAddress.map(|_x_| match _x_ {(rport,ip,mac) => (ip,mac,rport)})))
                                                                       .map(|((ip,mac,rport),())| (ip,mac,rport))
                                                                       .map(|(ip,mac,rport)| (true,rport.clone(),ip.clone(),mac.clone()))));
            let _delta_LearnedAddress = _delta_LearnedAddress.distinct();
            let (mut __realized_TunnelFromTo, _realized_TunnelFromTo) = outer.new_collection::<(u32,u32,u32),isize>();
            let _realized_TunnelFromTo = _realized_TunnelFromTo.distinct();
            let (mut __delta_TunnelFromTo, _delta_TunnelFromTo) = outer.new_collection::<(bool,u32,u32,u32),isize>();
            let _delta_TunnelFromTo = _delta_TunnelFromTo.concat(&(_realized_TunnelFromTo.map(|_x_| match _x_ {(fromChassis,toChassis,toip) => ((fromChassis,toChassis,toip),())})
                                                                   .antijoin(&(TunnelFromTo.map(|_x_| match _x_ {(fromChassis,toChassis,toip) => (fromChassis,toChassis,toip)})))
                                                                   .map(|((fromChassis,toChassis,toip),())| (fromChassis,toChassis,toip))
                                                                   .map(|(fromChassis,toChassis,toip)| (false,fromChassis.clone(),toChassis.clone(),toip.clone()))));
            let _delta_TunnelFromTo = _delta_TunnelFromTo.concat(&(TunnelFromTo.map(|_x_| match _x_ {(fromChassis,toChassis,toip) => ((fromChassis,toChassis,toip),())})
                                                                   .antijoin(&(_realized_TunnelFromTo.map(|_x_| match _x_ {(fromChassis,toChassis,toip) => (fromChassis,toChassis,toip)})))
                                                                   .map(|((fromChassis,toChassis,toip),())| (fromChassis,toChassis,toip))
                                                                   .map(|(fromChassis,toChassis,toip)| (true,fromChassis.clone(),toChassis.clone(),toip.clone()))));
            let _delta_TunnelFromTo = _delta_TunnelFromTo.distinct();
            let (mut __realized_TunnelPort, _realized_TunnelPort) = outer.new_collection::<(u64,u16,u32,u32),isize>();
            let _realized_TunnelPort = _realized_TunnelPort.distinct();
            let (mut __delta_TunnelPort, _delta_TunnelPort) = outer.new_collection::<(bool,u64,u16,u32,u32),isize>();
            let _delta_TunnelPort = _delta_TunnelPort.concat(&(_realized_TunnelPort.map(|_x_| match _x_ {(id,portnum,switch,externalip) => ((externalip,id,portnum,switch),())})
                                                               .antijoin(&(TunnelPort.map(|_x_| match _x_ {(id,portnum,switch,externalip) => (externalip,id,portnum,switch)})))
                                                               .map(|((externalip,id,portnum,switch),())| (externalip,id,portnum,switch))
                                                               .map(|(externalip,id,portnum,switch)| (false,id.clone(),portnum.clone(),switch.clone(),externalip.clone()))));
            let _delta_TunnelPort = _delta_TunnelPort.concat(&(TunnelPort.map(|_x_| match _x_ {(id,portnum,switch,externalip) => ((externalip,id,portnum,switch),())})
                                                               .antijoin(&(_realized_TunnelPort.map(|_x_| match _x_ {(id,portnum,switch,externalip) => (externalip,id,portnum,switch)})))
                                                               .map(|((externalip,id,portnum,switch),())| (externalip,id,portnum,switch))
                                                               .map(|(externalip,id,portnum,switch)| (true,id.clone(),portnum.clone(),switch.clone(),externalip.clone()))));
            let _delta_TunnelPort = _delta_TunnelPort.distinct();
            let (mut __realized_Route, _realized_Route) = outer.new_collection::<(u64,ip_subnet_t,opt_ip_addr_t,u32,u64,ip_addr_t),isize>();
            let _realized_Route = _realized_Route.distinct();
            let (mut __delta_Route, _delta_Route) = outer.new_collection::<(bool,u64,ip_subnet_t,opt_ip_addr_t,u32,u64,ip_addr_t),isize>();
            let _delta_Route = _delta_Route.concat(&(_realized_Route.map(|_x_| match _x_ {(lrouter,ip_prefix,nexthop,outport,outportmac,outportip) => ((ip_prefix,lrouter,nexthop,outport,outportip,outportmac),())})
                                                     .antijoin(&(Route.map(|_x_| match _x_ {(lrouter,ip_prefix,nexthop,outport,outportmac,outportip) => (ip_prefix,lrouter,nexthop,outport,outportip,outportmac)})))
                                                     .map(|((ip_prefix,lrouter,nexthop,outport,outportip,outportmac),())| (ip_prefix,lrouter,nexthop,outport,outportip,outportmac))
                                                     .map(|(ip_prefix,lrouter,nexthop,outport,outportip,outportmac)| (false,lrouter.clone(),ip_prefix.clone(),nexthop.clone(),outport.clone(),outportmac.clone(),outportip.clone()))));
            let _delta_Route = _delta_Route.concat(&(Route.map(|_x_| match _x_ {(lrouter,ip_prefix,nexthop,outport,outportmac,outportip) => ((ip_prefix,lrouter,nexthop,outport,outportip,outportmac),())})
                                                     .antijoin(&(_realized_Route.map(|_x_| match _x_ {(lrouter,ip_prefix,nexthop,outport,outportmac,outportip) => (ip_prefix,lrouter,nexthop,outport,outportip,outportmac)})))
                                                     .map(|((ip_prefix,lrouter,nexthop,outport,outportip,outportmac),())| (ip_prefix,lrouter,nexthop,outport,outportip,outportmac))
                                                     .map(|(ip_prefix,lrouter,nexthop,outport,outportip,outportmac)| (true,lrouter.clone(),ip_prefix.clone(),nexthop.clone(),outport.clone(),outportmac.clone(),outportip.clone()))));
            let _delta_Route = _delta_Route.distinct();
            let (mut __realized_LPortAtChassis, _realized_LPortAtChassis) = outer.new_collection::<(u64,u64,u32,bool),isize>();
            let _realized_LPortAtChassis = _realized_LPortAtChassis.distinct();
            let (mut __delta_LPortAtChassis, _delta_LPortAtChassis) = outer.new_collection::<(bool,u64,u64,u32,bool),isize>();
            let _delta_LPortAtChassis = _delta_LPortAtChassis.concat(&(_realized_LPortAtChassis.map(|_x_| match _x_ {(lport,lswitch,chassis,float) => ((chassis,float,lport,lswitch),())})
                                                                       .antijoin(&(LPortAtChassis.map(|_x_| match _x_ {(lport,lswitch,chassis,float) => (chassis,float,lport,lswitch)})))
                                                                       .map(|((chassis,float,lport,lswitch),())| (chassis,float,lport,lswitch))
                                                                       .map(|(chassis,float,lport,lswitch)| (false,lport.clone(),lswitch.clone(),chassis.clone(),float.clone()))));
            let _delta_LPortAtChassis = _delta_LPortAtChassis.concat(&(LPortAtChassis.map(|_x_| match _x_ {(lport,lswitch,chassis,float) => ((chassis,float,lport,lswitch),())})
                                                                       .antijoin(&(_realized_LPortAtChassis.map(|_x_| match _x_ {(lport,lswitch,chassis,float) => (chassis,float,lport,lswitch)})))
                                                                       .map(|((chassis,float,lport,lswitch),())| (chassis,float,lport,lswitch))
                                                                       .map(|(chassis,float,lport,lswitch)| (true,lport.clone(),lswitch.clone(),chassis.clone(),float.clone()))));
            let _delta_LPortAtChassis = _delta_LPortAtChassis.distinct();
            let (mut __realized_LPortMACChassis, _realized_LPortMACChassis) = outer.new_collection::<(u64,u64,u64,u32,bool),isize>();
            let _realized_LPortMACChassis = _realized_LPortMACChassis.distinct();
            let (mut __delta_LPortMACChassis, _delta_LPortMACChassis) = outer.new_collection::<(bool,u64,u64,u64,u32,bool),isize>();
            let _delta_LPortMACChassis = _delta_LPortMACChassis.concat(&(_realized_LPortMACChassis.map(|_x_| match _x_ {(lswitch,lport,mac,chassis,float) => ((chassis,float,lport,lswitch,mac),())})
                                                                         .antijoin(&(LPortMACChassis.map(|_x_| match _x_ {(lswitch,lport,mac,chassis,float) => (chassis,float,lport,lswitch,mac)})))
                                                                         .map(|((chassis,float,lport,lswitch,mac),())| (chassis,float,lport,lswitch,mac))
                                                                         .map(|(chassis,float,lport,lswitch,mac)| (false,lswitch.clone(),lport.clone(),mac.clone(),chassis.clone(),float.clone()))));
            let _delta_LPortMACChassis = _delta_LPortMACChassis.concat(&(LPortMACChassis.map(|_x_| match _x_ {(lswitch,lport,mac,chassis,float) => ((chassis,float,lport,lswitch,mac),())})
                                                                         .antijoin(&(_realized_LPortMACChassis.map(|_x_| match _x_ {(lswitch,lport,mac,chassis,float) => (chassis,float,lport,lswitch,mac)})))
                                                                         .map(|((chassis,float,lport,lswitch,mac),())| (chassis,float,lport,lswitch,mac))
                                                                         .map(|(chassis,float,lport,lswitch,mac)| (true,lswitch.clone(),lport.clone(),mac.clone(),chassis.clone(),float.clone()))));
            let _delta_LPortMACChassis = _delta_LPortMACChassis.distinct();
            let (mut __realized_LPortUnknownMACChassis, _realized_LPortUnknownMACChassis) = outer.new_collection::<(u64,u64,u32,bool),isize>();
            let _realized_LPortUnknownMACChassis = _realized_LPortUnknownMACChassis.distinct();
            let (mut __delta_LPortUnknownMACChassis, _delta_LPortUnknownMACChassis) = outer.new_collection::<(bool,u64,u64,u32,bool),isize>();
            let _delta_LPortUnknownMACChassis = _delta_LPortUnknownMACChassis.concat(&(_realized_LPortUnknownMACChassis.map(|_x_| match _x_ {(lswitch,lport,chassis,float) => ((chassis,float,lport,lswitch),())})
                                                                                       .antijoin(&(LPortUnknownMACChassis.map(|_x_| match _x_ {(lswitch,lport,chassis,float) => (chassis,float,lport,lswitch)})))
                                                                                       .map(|((chassis,float,lport,lswitch),())| (chassis,float,lport,lswitch))
                                                                                       .map(|(chassis,float,lport,lswitch)| (false,lswitch.clone(),lport.clone(),chassis.clone(),float.clone()))));
            let _delta_LPortUnknownMACChassis = _delta_LPortUnknownMACChassis.concat(&(LPortUnknownMACChassis.map(|_x_| match _x_ {(lswitch,lport,chassis,float) => ((chassis,float,lport,lswitch),())})
                                                                                       .antijoin(&(_realized_LPortUnknownMACChassis.map(|_x_| match _x_ {(lswitch,lport,chassis,float) => (chassis,float,lport,lswitch)})))
                                                                                       .map(|((chassis,float,lport,lswitch),())| (chassis,float,lport,lswitch))
                                                                                       .map(|(chassis,float,lport,lswitch)| (true,lswitch.clone(),lport.clone(),chassis.clone(),float.clone()))));
            let _delta_LPortUnknownMACChassis = _delta_LPortUnknownMACChassis.distinct();
            let (mut __realized_LPortLB, _realized_LPortLB) = outer.new_collection::<u64,isize>();
            let _realized_LPortLB = _realized_LPortLB.distinct();
            let (mut __delta_LPortLB, _delta_LPortLB) = outer.new_collection::<(bool,u64),isize>();
            let _delta_LPortLB = _delta_LPortLB.concat(&(_realized_LPortLB.map(|_x_| match _x_ {lport => (lport,())})
                                                         .antijoin(&(LPortLB.map(|_x_| match _x_ {lport => lport})))
                                                         .map(|(lport,())| lport)
                                                         .map(|lport| (false,lport.clone()))));
            let _delta_LPortLB = _delta_LPortLB.concat(&(LPortLB.map(|_x_| match _x_ {lport => (lport,())})
                                                         .antijoin(&(_realized_LPortLB.map(|_x_| match _x_ {lport => lport})))
                                                         .map(|(lport,())| lport)
                                                         .map(|lport| (true,lport.clone()))));
            let _delta_LPortLB = _delta_LPortLB.distinct();
            let (mut __realized_Chassis, _realized_Chassis) = outer.new_collection::<(u32,bool,String,String),isize>();
            let _realized_Chassis = _realized_Chassis.distinct();
            let (mut __delta_Chassis, _delta_Chassis) = outer.new_collection::<(bool,u32,bool,String,String),isize>();
            let _delta_Chassis = _delta_Chassis.concat(&(_realized_Chassis.map(|_x_| match _x_ {(id,failed,name,address) => ((address,failed,id,name),())})
                                                         .antijoin(&(Chassis.map(|_x_| match _x_ {(id,failed,name,address) => (address,failed,id,name)})))
                                                         .map(|((address,failed,id,name),())| (address,failed,id,name))
                                                         .map(|(address,failed,id,name)| (false,id.clone(),failed.clone(),name.clone(),address.clone()))));
            let _delta_Chassis = _delta_Chassis.concat(&(Chassis.map(|_x_| match _x_ {(id,failed,name,address) => ((address,failed,id,name),())})
                                                         .antijoin(&(_realized_Chassis.map(|_x_| match _x_ {(id,failed,name,address) => (address,failed,id,name)})))
                                                         .map(|((address,failed,id,name),())| (address,failed,id,name))
                                                         .map(|(address,failed,id,name)| (true,id.clone(),failed.clone(),name.clone(),address.clone()))));
            let _delta_Chassis = _delta_Chassis.distinct();
            LogicalSwitch.inspect(move |x| xupd(&_wLogicalSwitch, &__wDeltaLogicalSwitch, &(x.0), x.2)).probe_with(&mut probe1);
            Chassis.inspect(move |x| xupd(&_wChassis, &__wDeltaChassis, &(x.0), x.2)).probe_with(&mut probe1);
            LogicalRouter.inspect(move |x| xupd(&_wLogicalRouter, &__wDeltaLogicalRouter, &(x.0), x.2)).probe_with(&mut probe1);
            LogicalRouterPort.inspect(move |x| xupd(&_wLogicalRouterPort, &__wDeltaLogicalRouterPort, &(x.0), x.2)).probe_with(&mut probe1);
            DHCPv4Options.inspect(move |x| xupd(&_wDHCPv4Options, &__wDeltaDHCPv4Options, &(x.0), x.2)).probe_with(&mut probe1);
            DHCPv6Options.inspect(move |x| xupd(&_wDHCPv6Options, &__wDeltaDHCPv6Options, &(x.0), x.2)).probe_with(&mut probe1);
            PhysicalNetwork.inspect(move |x| xupd(&_wPhysicalNetwork, &__wDeltaPhysicalNetwork, &(x.0), x.2)).probe_with(&mut probe1);
            LogicalSwitchPort.inspect(move |x| xupd(&_wLogicalSwitchPort, &__wDeltaLogicalSwitchPort, &(x.0), x.2)).probe_with(&mut probe1);
            LogicalSwitchPortMAC.inspect(move |x| xupd(&_wLogicalSwitchPortMAC, &__wDeltaLogicalSwitchPortMAC, &(x.0), x.2)).probe_with(&mut probe1);
            LogicalSwitchPortIP.inspect(move |x| xupd(&_wLogicalSwitchPortIP, &__wDeltaLogicalSwitchPortIP, &(x.0), x.2)).probe_with(&mut probe1);
            LogicalSwitchPortDynAddr.inspect(move |x| xupd(&_wLogicalSwitchPortDynAddr, &__wDeltaLogicalSwitchPortDynAddr, &(x.0), x.2)).probe_with(&mut probe1);
            VSwitchPort.inspect(move |x| xupd(&_wVSwitchPort, &__wDeltaVSwitchPort, &(x.0), x.2)).probe_with(&mut probe1);
            LPortBinding.inspect(move |x| xupd(&_wLPortBinding, &__wDeltaLPortBinding, &(x.0), x.2)).probe_with(&mut probe1);
            PortSecurityMAC.inspect(move |x| xupd(&_wPortSecurityMAC, &__wDeltaPortSecurityMAC, &(x.0), x.2)).probe_with(&mut probe1);
            PortSecurityIP.inspect(move |x| xupd(&_wPortSecurityIP, &__wDeltaPortSecurityIP, &(x.0), x.2)).probe_with(&mut probe1);
            AddressSet.inspect(move |x| xupd(&_wAddressSet, &__wDeltaAddressSet, &(x.0), x.2)).probe_with(&mut probe1);
            AddressSetAddr.inspect(move |x| xupd(&_wAddressSetAddr, &__wDeltaAddressSetAddr, &(x.0), x.2)).probe_with(&mut probe1);
            LoadBalancer.inspect(move |x| xupd(&_wLoadBalancer, &__wDeltaLoadBalancer, &(x.0), x.2)).probe_with(&mut probe1);
            LBSwitch.inspect(move |x| xupd(&_wLBSwitch, &__wDeltaLBSwitch, &(x.0), x.2)).probe_with(&mut probe1);
            LBVIP.inspect(move |x| xupd(&_wLBVIP, &__wDeltaLBVIP, &(x.0), x.2)).probe_with(&mut probe1);
            LBIP.inspect(move |x| xupd(&_wLBIP, &__wDeltaLBIP, &(x.0), x.2)).probe_with(&mut probe1);
            ACL.inspect(move |x| xupd(&_wACL, &__wDeltaACL, &(x.0), x.2)).probe_with(&mut probe1);
            LBRouter.inspect(move |x| xupd(&_wLBRouter, &__wDeltaLBRouter, &(x.0), x.2)).probe_with(&mut probe1);
            LRouterPortNetwork.inspect(move |x| xupd(&_wLRouterPortNetwork, &__wDeltaLRouterPortNetwork, &(x.0), x.2)).probe_with(&mut probe1);
            LogicalRouterStaticRoute.inspect(move |x| xupd(&_wLogicalRouterStaticRoute, &__wDeltaLogicalRouterStaticRoute, &(x.0), x.2)).probe_with(&mut probe1);
            NAT.inspect(move |x| xupd(&_wNAT, &__wDeltaNAT, &(x.0), x.2)).probe_with(&mut probe1);
            LearnedAddress.inspect(move |x| xupd(&_wLearnedAddress, &__wDeltaLearnedAddress, &(x.0), x.2)).probe_with(&mut probe1);
            TunnelPort.inspect(move |x| xupd(&_wTunnelPort, &__wDeltaTunnelPort, &(x.0), x.2)).probe_with(&mut probe1);
            TrunkPort.inspect(move |x| upd(&_wTrunkPort, &(x.0), x.2)).probe_with(&mut probe1);
            PortSecurityEnabled.inspect(move |x| upd(&_wPortSecurityEnabled, &(x.0), x.2)).probe_with(&mut probe1);
            PortIPSecurityEnabled.inspect(move |x| upd(&_wPortIPSecurityEnabled, &(x.0), x.2)).probe_with(&mut probe1);
            PortSecurityType.inspect(move |x| upd(&_wPortSecurityType, &(x.0), x.2)).probe_with(&mut probe1);
            PortSecurityIP4Match.inspect(move |x| upd(&_wPortSecurityIP4Match, &(x.0), x.2)).probe_with(&mut probe1);
            PortSecurityIP6Match.inspect(move |x| upd(&_wPortSecurityIP6Match, &(x.0), x.2)).probe_with(&mut probe1);
            LPortStatefulACL.inspect(move |x| upd(&_wLPortStatefulACL, &(x.0), x.2)).probe_with(&mut probe1);
            LPortLBVIP.inspect(move |x| upd(&_wLPortLBVIP, &(x.0), x.2)).probe_with(&mut probe1);
            LPortLBVIPIP.inspect(move |x| upd(&_wLPortLBVIPIP, &(x.0), x.2)).probe_with(&mut probe1);
            LPortLB.inspect(move |x| upd(&_wLPortLB, &(x.0), x.2)).probe_with(&mut probe1);
            LPortMACIP.inspect(move |x| upd(&_wLPortMACIP, &(x.0), x.2)).probe_with(&mut probe1);
            LPortDHCP4AddrOpts.inspect(move |x| upd(&_wLPortDHCP4AddrOpts, &(x.0), x.2)).probe_with(&mut probe1);
            LPortDHCP6AddrOpts.inspect(move |x| upd(&_wLPortDHCP6AddrOpts, &(x.0), x.2)).probe_with(&mut probe1);
            LPortAtChassis.inspect(move |x| upd(&_wLPortAtChassis, &(x.0), x.2)).probe_with(&mut probe1);
            LPortMACChassis.inspect(move |x| upd(&_wLPortMACChassis, &(x.0), x.2)).probe_with(&mut probe1);
            LPortUnknownMACChassis.inspect(move |x| upd(&_wLPortUnknownMACChassis, &(x.0), x.2)).probe_with(&mut probe1);
            LSwitchAtChassis.inspect(move |x| upd(&_wLSwitchAtChassis, &(x.0), x.2)).probe_with(&mut probe1);
            MACChassis.inspect(move |x| upd(&_wMACChassis, &(x.0), x.2)).probe_with(&mut probe1);
            UnknownMACChassis.inspect(move |x| upd(&_wUnknownMACChassis, &(x.0), x.2)).probe_with(&mut probe1);
            TunnelFromTo.inspect(move |x| upd(&_wTunnelFromTo, &(x.0), x.2)).probe_with(&mut probe1);
            LRouterNetwork.inspect(move |x| upd(&_wLRouterNetwork, &(x.0), x.2)).probe_with(&mut probe1);
            LRouterLBVIP.inspect(move |x| upd(&_wLRouterLBVIP, &(x.0), x.2)).probe_with(&mut probe1);
            NATChassis.inspect(move |x| upd(&_wNATChassis, &(x.0), x.2)).probe_with(&mut probe1);
            Route.inspect(move |x| upd(&_wRoute, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_VSwitchPort.inspect(move |x| xupd(&_w_realized_VSwitchPort, &__wDelta_realized_VSwitchPort, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_VSwitchPort.inspect(move |x| upd(&_w_delta_VSwitchPort, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LPortBinding.inspect(move |x| xupd(&_w_realized_LPortBinding, &__wDelta_realized_LPortBinding, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LPortBinding.inspect(move |x| upd(&_w_delta_LPortBinding, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LogicalSwitchPort.inspect(move |x| xupd(&_w_realized_LogicalSwitchPort, &__wDelta_realized_LogicalSwitchPort, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LogicalSwitchPort.inspect(move |x| upd(&_w_delta_LogicalSwitchPort, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_PortSecurityType.inspect(move |x| xupd(&_w_realized_PortSecurityType, &__wDelta_realized_PortSecurityType, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_PortSecurityType.inspect(move |x| upd(&_w_delta_PortSecurityType, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_PortSecurityMAC.inspect(move |x| xupd(&_w_realized_PortSecurityMAC, &__wDelta_realized_PortSecurityMAC, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_PortSecurityMAC.inspect(move |x| upd(&_w_delta_PortSecurityMAC, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LPortStatefulACL.inspect(move |x| xupd(&_w_realized_LPortStatefulACL, &__wDelta_realized_LPortStatefulACL, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LPortStatefulACL.inspect(move |x| upd(&_w_delta_LPortStatefulACL, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LPortLBVIP.inspect(move |x| xupd(&_w_realized_LPortLBVIP, &__wDelta_realized_LPortLBVIP, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LPortLBVIP.inspect(move |x| upd(&_w_delta_LPortLBVIP, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_ACL.inspect(move |x| xupd(&_w_realized_ACL, &__wDelta_realized_ACL, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_ACL.inspect(move |x| upd(&_w_delta_ACL, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LPortLBVIPIP.inspect(move |x| xupd(&_w_realized_LPortLBVIPIP, &__wDelta_realized_LPortLBVIPIP, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LPortLBVIPIP.inspect(move |x| upd(&_w_delta_LPortLBVIPIP, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LPortMACIP.inspect(move |x| xupd(&_w_realized_LPortMACIP, &__wDelta_realized_LPortMACIP, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LPortMACIP.inspect(move |x| upd(&_w_delta_LPortMACIP, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LPortDHCP4AddrOpts.inspect(move |x| xupd(&_w_realized_LPortDHCP4AddrOpts, &__wDelta_realized_LPortDHCP4AddrOpts, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LPortDHCP4AddrOpts.inspect(move |x| upd(&_w_delta_LPortDHCP4AddrOpts, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LPortDHCP6AddrOpts.inspect(move |x| xupd(&_w_realized_LPortDHCP6AddrOpts, &__wDelta_realized_LPortDHCP6AddrOpts, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LPortDHCP6AddrOpts.inspect(move |x| upd(&_w_delta_LPortDHCP6AddrOpts, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LSwitchAtChassis.inspect(move |x| xupd(&_w_realized_LSwitchAtChassis, &__wDelta_realized_LSwitchAtChassis, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LSwitchAtChassis.inspect(move |x| upd(&_w_delta_LSwitchAtChassis, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_MACChassis.inspect(move |x| xupd(&_w_realized_MACChassis, &__wDelta_realized_MACChassis, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_MACChassis.inspect(move |x| upd(&_w_delta_MACChassis, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_UnknownMACChassis.inspect(move |x| xupd(&_w_realized_UnknownMACChassis, &__wDelta_realized_UnknownMACChassis, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_UnknownMACChassis.inspect(move |x| upd(&_w_delta_UnknownMACChassis, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_PortSecurityIP4Match.inspect(move |x| xupd(&_w_realized_PortSecurityIP4Match, &__wDelta_realized_PortSecurityIP4Match, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_PortSecurityIP4Match.inspect(move |x| upd(&_w_delta_PortSecurityIP4Match, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_PortSecurityIP.inspect(move |x| xupd(&_w_realized_PortSecurityIP, &__wDelta_realized_PortSecurityIP, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_PortSecurityIP.inspect(move |x| upd(&_w_delta_PortSecurityIP, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_PortSecurityIP6Match.inspect(move |x| xupd(&_w_realized_PortSecurityIP6Match, &__wDelta_realized_PortSecurityIP6Match, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_PortSecurityIP6Match.inspect(move |x| upd(&_w_delta_PortSecurityIP6Match, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LogicalRouterPort.inspect(move |x| xupd(&_w_realized_LogicalRouterPort, &__wDelta_realized_LogicalRouterPort, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LogicalRouterPort.inspect(move |x| upd(&_w_delta_LogicalRouterPort, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_NATChassis.inspect(move |x| xupd(&_w_realized_NATChassis, &__wDelta_realized_NATChassis, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_NATChassis.inspect(move |x| upd(&_w_delta_NATChassis, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LRouterNetwork.inspect(move |x| xupd(&_w_realized_LRouterNetwork, &__wDelta_realized_LRouterNetwork, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LRouterNetwork.inspect(move |x| upd(&_w_delta_LRouterNetwork, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LRouterPortNetwork.inspect(move |x| xupd(&_w_realized_LRouterPortNetwork, &__wDelta_realized_LRouterPortNetwork, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LRouterPortNetwork.inspect(move |x| upd(&_w_delta_LRouterPortNetwork, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LRouterLBVIP.inspect(move |x| xupd(&_w_realized_LRouterLBVIP, &__wDelta_realized_LRouterLBVIP, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LRouterLBVIP.inspect(move |x| upd(&_w_delta_LRouterLBVIP, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_NAT.inspect(move |x| xupd(&_w_realized_NAT, &__wDelta_realized_NAT, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_NAT.inspect(move |x| upd(&_w_delta_NAT, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LearnedAddress.inspect(move |x| xupd(&_w_realized_LearnedAddress, &__wDelta_realized_LearnedAddress, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LearnedAddress.inspect(move |x| upd(&_w_delta_LearnedAddress, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_TunnelFromTo.inspect(move |x| xupd(&_w_realized_TunnelFromTo, &__wDelta_realized_TunnelFromTo, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_TunnelFromTo.inspect(move |x| upd(&_w_delta_TunnelFromTo, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_TunnelPort.inspect(move |x| xupd(&_w_realized_TunnelPort, &__wDelta_realized_TunnelPort, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_TunnelPort.inspect(move |x| upd(&_w_delta_TunnelPort, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_Route.inspect(move |x| xupd(&_w_realized_Route, &__wDelta_realized_Route, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_Route.inspect(move |x| upd(&_w_delta_Route, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LPortAtChassis.inspect(move |x| xupd(&_w_realized_LPortAtChassis, &__wDelta_realized_LPortAtChassis, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LPortAtChassis.inspect(move |x| upd(&_w_delta_LPortAtChassis, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LPortMACChassis.inspect(move |x| xupd(&_w_realized_LPortMACChassis, &__wDelta_realized_LPortMACChassis, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LPortMACChassis.inspect(move |x| upd(&_w_delta_LPortMACChassis, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LPortUnknownMACChassis.inspect(move |x| xupd(&_w_realized_LPortUnknownMACChassis, &__wDelta_realized_LPortUnknownMACChassis, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LPortUnknownMACChassis.inspect(move |x| upd(&_w_delta_LPortUnknownMACChassis, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_LPortLB.inspect(move |x| xupd(&_w_realized_LPortLB, &__wDelta_realized_LPortLB, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_LPortLB.inspect(move |x| upd(&_w_delta_LPortLB, &(x.0), x.2)).probe_with(&mut probe1);
            _realized_Chassis.inspect(move |x| xupd(&_w_realized_Chassis, &__wDelta_realized_Chassis, &(x.0), x.2)).probe_with(&mut probe1);
            _delta_Chassis.inspect(move |x| upd(&_w_delta_Chassis, &(x.0), x.2)).probe_with(&mut probe1);
            (_LogicalSwitch,_Chassis,_LogicalRouter,_LogicalRouterPort,_DHCPv4Options,_DHCPv6Options,_PhysicalNetwork,_LogicalSwitchPort,_LogicalSwitchPortMAC,_LogicalSwitchPortIP,_LogicalSwitchPortDynAddr,_VSwitchPort,_LPortBinding,_PortSecurityMAC,_PortSecurityIP,_AddressSet,_AddressSetAddr,_LoadBalancer,_LBSwitch,_LBVIP,_LBIP,_ACL,_LBRouter,_LRouterPortNetwork,_LogicalRouterStaticRoute,_NAT,_LearnedAddress,_TunnelPort,_TrunkPort,_PortSecurityEnabled,_PortIPSecurityEnabled,_PortSecurityType,_PortSecurityIP4Match,_PortSecurityIP6Match,_LPortStatefulACL,_LPortLBVIP,_LPortLBVIPIP,_LPortLB,_LPortMACIP,_LPortDHCP4AddrOpts,_LPortDHCP6AddrOpts,_LPortAtChassis,_LPortMACChassis,_LPortUnknownMACChassis,_LSwitchAtChassis,_MACChassis,_UnknownMACChassis,_TunnelFromTo,_LRouterNetwork,_LRouterLBVIP,_NATChassis,_Route,__realized_VSwitchPort,__delta_VSwitchPort,__realized_LPortBinding,__delta_LPortBinding,__realized_LogicalSwitchPort,__delta_LogicalSwitchPort,__realized_PortSecurityType,__delta_PortSecurityType,__realized_PortSecurityMAC,__delta_PortSecurityMAC,__realized_LPortStatefulACL,__delta_LPortStatefulACL,__realized_LPortLBVIP,__delta_LPortLBVIP,__realized_ACL,__delta_ACL,__realized_LPortLBVIPIP,__delta_LPortLBVIPIP,__realized_LPortMACIP,__delta_LPortMACIP,__realized_LPortDHCP4AddrOpts,__delta_LPortDHCP4AddrOpts,__realized_LPortDHCP6AddrOpts,__delta_LPortDHCP6AddrOpts,__realized_LSwitchAtChassis,__delta_LSwitchAtChassis,__realized_MACChassis,__delta_MACChassis,__realized_UnknownMACChassis,__delta_UnknownMACChassis,__realized_PortSecurityIP4Match,__delta_PortSecurityIP4Match,__realized_PortSecurityIP,__delta_PortSecurityIP,__realized_PortSecurityIP6Match,__delta_PortSecurityIP6Match,__realized_LogicalRouterPort,__delta_LogicalRouterPort,__realized_NATChassis,__delta_NATChassis,__realized_LRouterNetwork,__delta_LRouterNetwork,__realized_LRouterPortNetwork,__delta_LRouterPortNetwork,__realized_LRouterLBVIP,__delta_LRouterLBVIP,__realized_NAT,__delta_NAT,__realized_LearnedAddress,__delta_LearnedAddress,__realized_TunnelFromTo,__delta_TunnelFromTo,__realized_TunnelPort,__delta_TunnelPort,__realized_Route,__delta_Route,__realized_LPortAtChassis,__delta_LPortAtChassis,__realized_LPortMACChassis,__delta_LPortMACChassis,__realized_LPortUnknownMACChassis,__delta_LPortUnknownMACChassis,__realized_LPortLB,__delta_LPortLB,__realized_Chassis,__delta_Chassis)
        });

        let mut epoch = 0;
        let stream = json::Deserializer::from_reader(stdin()).into_iter::<Request>();

        for val in stream {
            //print!("epoch: {}\n", epoch);
            let req = match val {
                            Ok(r)  => {
                                //print!("r: {:?}\n", r);
                                r
                            },
                            Err(e) => {
                                print!("{}\n", e);
                                std::process::exit(-1);
                            }
                        };
            macro_rules! advance {
                () => {{
                    _LogicalSwitch.advance_to(epoch);
                    _Chassis.advance_to(epoch);
                    _LogicalRouter.advance_to(epoch);
                    _LogicalRouterPort.advance_to(epoch);
                    _DHCPv4Options.advance_to(epoch);
                    _DHCPv6Options.advance_to(epoch);
                    _PhysicalNetwork.advance_to(epoch);
                    _LogicalSwitchPort.advance_to(epoch);
                    _LogicalSwitchPortMAC.advance_to(epoch);
                    _LogicalSwitchPortIP.advance_to(epoch);
                    _LogicalSwitchPortDynAddr.advance_to(epoch);
                    _VSwitchPort.advance_to(epoch);
                    _LPortBinding.advance_to(epoch);
                    _PortSecurityMAC.advance_to(epoch);
                    _PortSecurityIP.advance_to(epoch);
                    _AddressSet.advance_to(epoch);
                    _AddressSetAddr.advance_to(epoch);
                    _LoadBalancer.advance_to(epoch);
                    _LBSwitch.advance_to(epoch);
                    _LBVIP.advance_to(epoch);
                    _LBIP.advance_to(epoch);
                    _ACL.advance_to(epoch);
                    _LBRouter.advance_to(epoch);
                    _LRouterPortNetwork.advance_to(epoch);
                    _LogicalRouterStaticRoute.advance_to(epoch);
                    _NAT.advance_to(epoch);
                    _LearnedAddress.advance_to(epoch);
                    _TunnelPort.advance_to(epoch);
                    _TrunkPort.advance_to(epoch);
                    _PortSecurityEnabled.advance_to(epoch);
                    _PortIPSecurityEnabled.advance_to(epoch);
                    _PortSecurityType.advance_to(epoch);
                    _PortSecurityIP4Match.advance_to(epoch);
                    _PortSecurityIP6Match.advance_to(epoch);
                    _LPortStatefulACL.advance_to(epoch);
                    _LPortLBVIP.advance_to(epoch);
                    _LPortLBVIPIP.advance_to(epoch);
                    _LPortLB.advance_to(epoch);
                    _LPortMACIP.advance_to(epoch);
                    _LPortDHCP4AddrOpts.advance_to(epoch);
                    _LPortDHCP6AddrOpts.advance_to(epoch);
                    _LPortAtChassis.advance_to(epoch);
                    _LPortMACChassis.advance_to(epoch);
                    _LPortUnknownMACChassis.advance_to(epoch);
                    _LSwitchAtChassis.advance_to(epoch);
                    _MACChassis.advance_to(epoch);
                    _UnknownMACChassis.advance_to(epoch);
                    _TunnelFromTo.advance_to(epoch);
                    _LRouterNetwork.advance_to(epoch);
                    _LRouterLBVIP.advance_to(epoch);
                    _NATChassis.advance_to(epoch);
                    _Route.advance_to(epoch);
                    __realized_VSwitchPort.advance_to(epoch);
                    __delta_VSwitchPort.advance_to(epoch);
                    __realized_LPortBinding.advance_to(epoch);
                    __delta_LPortBinding.advance_to(epoch);
                    __realized_LogicalSwitchPort.advance_to(epoch);
                    __delta_LogicalSwitchPort.advance_to(epoch);
                    __realized_PortSecurityType.advance_to(epoch);
                    __delta_PortSecurityType.advance_to(epoch);
                    __realized_PortSecurityMAC.advance_to(epoch);
                    __delta_PortSecurityMAC.advance_to(epoch);
                    __realized_LPortStatefulACL.advance_to(epoch);
                    __delta_LPortStatefulACL.advance_to(epoch);
                    __realized_LPortLBVIP.advance_to(epoch);
                    __delta_LPortLBVIP.advance_to(epoch);
                    __realized_ACL.advance_to(epoch);
                    __delta_ACL.advance_to(epoch);
                    __realized_LPortLBVIPIP.advance_to(epoch);
                    __delta_LPortLBVIPIP.advance_to(epoch);
                    __realized_LPortMACIP.advance_to(epoch);
                    __delta_LPortMACIP.advance_to(epoch);
                    __realized_LPortDHCP4AddrOpts.advance_to(epoch);
                    __delta_LPortDHCP4AddrOpts.advance_to(epoch);
                    __realized_LPortDHCP6AddrOpts.advance_to(epoch);
                    __delta_LPortDHCP6AddrOpts.advance_to(epoch);
                    __realized_LSwitchAtChassis.advance_to(epoch);
                    __delta_LSwitchAtChassis.advance_to(epoch);
                    __realized_MACChassis.advance_to(epoch);
                    __delta_MACChassis.advance_to(epoch);
                    __realized_UnknownMACChassis.advance_to(epoch);
                    __delta_UnknownMACChassis.advance_to(epoch);
                    __realized_PortSecurityIP4Match.advance_to(epoch);
                    __delta_PortSecurityIP4Match.advance_to(epoch);
                    __realized_PortSecurityIP.advance_to(epoch);
                    __delta_PortSecurityIP.advance_to(epoch);
                    __realized_PortSecurityIP6Match.advance_to(epoch);
                    __delta_PortSecurityIP6Match.advance_to(epoch);
                    __realized_LogicalRouterPort.advance_to(epoch);
                    __delta_LogicalRouterPort.advance_to(epoch);
                    __realized_NATChassis.advance_to(epoch);
                    __delta_NATChassis.advance_to(epoch);
                    __realized_LRouterNetwork.advance_to(epoch);
                    __delta_LRouterNetwork.advance_to(epoch);
                    __realized_LRouterPortNetwork.advance_to(epoch);
                    __delta_LRouterPortNetwork.advance_to(epoch);
                    __realized_LRouterLBVIP.advance_to(epoch);
                    __delta_LRouterLBVIP.advance_to(epoch);
                    __realized_NAT.advance_to(epoch);
                    __delta_NAT.advance_to(epoch);
                    __realized_LearnedAddress.advance_to(epoch);
                    __delta_LearnedAddress.advance_to(epoch);
                    __realized_TunnelFromTo.advance_to(epoch);
                    __delta_TunnelFromTo.advance_to(epoch);
                    __realized_TunnelPort.advance_to(epoch);
                    __delta_TunnelPort.advance_to(epoch);
                    __realized_Route.advance_to(epoch);
                    __delta_Route.advance_to(epoch);
                    __realized_LPortAtChassis.advance_to(epoch);
                    __delta_LPortAtChassis.advance_to(epoch);
                    __realized_LPortMACChassis.advance_to(epoch);
                    __delta_LPortMACChassis.advance_to(epoch);
                    __realized_LPortUnknownMACChassis.advance_to(epoch);
                    __delta_LPortUnknownMACChassis.advance_to(epoch);
                    __realized_LPortLB.advance_to(epoch);
                    __delta_LPortLB.advance_to(epoch);
                    __realized_Chassis.advance_to(epoch);
                    __delta_Chassis.advance_to(epoch);
                    _LogicalSwitch.flush();
                    _Chassis.flush();
                    _LogicalRouter.flush();
                    _LogicalRouterPort.flush();
                    _DHCPv4Options.flush();
                    _DHCPv6Options.flush();
                    _PhysicalNetwork.flush();
                    _LogicalSwitchPort.flush();
                    _LogicalSwitchPortMAC.flush();
                    _LogicalSwitchPortIP.flush();
                    _LogicalSwitchPortDynAddr.flush();
                    _VSwitchPort.flush();
                    _LPortBinding.flush();
                    _PortSecurityMAC.flush();
                    _PortSecurityIP.flush();
                    _AddressSet.flush();
                    _AddressSetAddr.flush();
                    _LoadBalancer.flush();
                    _LBSwitch.flush();
                    _LBVIP.flush();
                    _LBIP.flush();
                    _ACL.flush();
                    _LBRouter.flush();
                    _LRouterPortNetwork.flush();
                    _LogicalRouterStaticRoute.flush();
                    _NAT.flush();
                    _LearnedAddress.flush();
                    _TunnelPort.flush();
                    _TrunkPort.flush();
                    _PortSecurityEnabled.flush();
                    _PortIPSecurityEnabled.flush();
                    _PortSecurityType.flush();
                    _PortSecurityIP4Match.flush();
                    _PortSecurityIP6Match.flush();
                    _LPortStatefulACL.flush();
                    _LPortLBVIP.flush();
                    _LPortLBVIPIP.flush();
                    _LPortLB.flush();
                    _LPortMACIP.flush();
                    _LPortDHCP4AddrOpts.flush();
                    _LPortDHCP6AddrOpts.flush();
                    _LPortAtChassis.flush();
                    _LPortMACChassis.flush();
                    _LPortUnknownMACChassis.flush();
                    _LSwitchAtChassis.flush();
                    _MACChassis.flush();
                    _UnknownMACChassis.flush();
                    _TunnelFromTo.flush();
                    _LRouterNetwork.flush();
                    _LRouterLBVIP.flush();
                    _NATChassis.flush();
                    _Route.flush();
                    __realized_VSwitchPort.flush();
                    __delta_VSwitchPort.flush();
                    __realized_LPortBinding.flush();
                    __delta_LPortBinding.flush();
                    __realized_LogicalSwitchPort.flush();
                    __delta_LogicalSwitchPort.flush();
                    __realized_PortSecurityType.flush();
                    __delta_PortSecurityType.flush();
                    __realized_PortSecurityMAC.flush();
                    __delta_PortSecurityMAC.flush();
                    __realized_LPortStatefulACL.flush();
                    __delta_LPortStatefulACL.flush();
                    __realized_LPortLBVIP.flush();
                    __delta_LPortLBVIP.flush();
                    __realized_ACL.flush();
                    __delta_ACL.flush();
                    __realized_LPortLBVIPIP.flush();
                    __delta_LPortLBVIPIP.flush();
                    __realized_LPortMACIP.flush();
                    __delta_LPortMACIP.flush();
                    __realized_LPortDHCP4AddrOpts.flush();
                    __delta_LPortDHCP4AddrOpts.flush();
                    __realized_LPortDHCP6AddrOpts.flush();
                    __delta_LPortDHCP6AddrOpts.flush();
                    __realized_LSwitchAtChassis.flush();
                    __delta_LSwitchAtChassis.flush();
                    __realized_MACChassis.flush();
                    __delta_MACChassis.flush();
                    __realized_UnknownMACChassis.flush();
                    __delta_UnknownMACChassis.flush();
                    __realized_PortSecurityIP4Match.flush();
                    __delta_PortSecurityIP4Match.flush();
                    __realized_PortSecurityIP.flush();
                    __delta_PortSecurityIP.flush();
                    __realized_PortSecurityIP6Match.flush();
                    __delta_PortSecurityIP6Match.flush();
                    __realized_LogicalRouterPort.flush();
                    __delta_LogicalRouterPort.flush();
                    __realized_NATChassis.flush();
                    __delta_NATChassis.flush();
                    __realized_LRouterNetwork.flush();
                    __delta_LRouterNetwork.flush();
                    __realized_LRouterPortNetwork.flush();
                    __delta_LRouterPortNetwork.flush();
                    __realized_LRouterLBVIP.flush();
                    __delta_LRouterLBVIP.flush();
                    __realized_NAT.flush();
                    __delta_NAT.flush();
                    __realized_LearnedAddress.flush();
                    __delta_LearnedAddress.flush();
                    __realized_TunnelFromTo.flush();
                    __delta_TunnelFromTo.flush();
                    __realized_TunnelPort.flush();
                    __delta_TunnelPort.flush();
                    __realized_Route.flush();
                    __delta_Route.flush();
                    __realized_LPortAtChassis.flush();
                    __delta_LPortAtChassis.flush();
                    __realized_LPortMACChassis.flush();
                    __delta_LPortMACChassis.flush();
                    __realized_LPortUnknownMACChassis.flush();
                    __delta_LPortUnknownMACChassis.flush();
                    __realized_LPortLB.flush();
                    __delta_LPortLB.flush();
                    __realized_Chassis.flush();
                    __delta_Chassis.flush();
                }}
            }

            macro_rules! insert {
                ($rel:ident, $set:ident, $args:expr) => {{
                    let v = $args;
                    if !$set.borrow().contains(&v) {
                        $rel.insert(v);
                        epoch = epoch+1;
                        advance!();
                        while probe.less_than($rel.time()) {
                            worker.step();
                        };
                    };
                }}
            }

            macro_rules! insert_resp {
                ($rel:ident, $set:ident, $args:expr) => {{
                    insert!($rel, $set, $args);
                    let resp: Response<()> = Response::ok(());
                    serde_json::to_writer(stdout(), &resp).unwrap();
                    stdout().flush().unwrap();
                }}
            }

            macro_rules! remove {
                ($rel:ident, $set:ident, $args:expr) => {{
                    let v = $args;
                    if $set.borrow().contains(&v) {
                        $rel.remove(v);
                        epoch = epoch+1;
                        advance!();
                        while probe.less_than($rel.time()) {
                            worker.step();
                        };
                    };
                }}
            }

            macro_rules! remove_resp {
                ($rel:ident, $set:ident, $args:expr) => {{
                    remove!($rel, $set, $args);
                    let resp: Response<()> = Response::ok(());
                    serde_json::to_writer(stdout(), &resp).unwrap();
                    stdout().flush().unwrap();
                }}
            }

            macro_rules! check {
                ($set:expr) => {{
                    let resp = Response::ok(!$set.borrow().is_empty());
                    serde_json::to_writer(stdout(), &resp).unwrap();
                    stdout().flush().unwrap();
                }}
            }

            macro_rules! enm {
                ($set:expr) => {{
                    let resp = Response::ok((*$set).clone());
                    serde_json::to_writer(stdout(), &resp).unwrap();
                    stdout().flush().unwrap();
                }}
            }
            macro_rules! delta {
                ($delta: expr) => {{
                    let d = __rDeltaLogicalSwitch.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LogicalSwitch(a1.clone(), a2.clone(), a3.clone(), a4.clone()),v.clone()));
                    };
                    let d = __rDeltaChassis.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::Chassis(a1.clone(), a2.clone(), a3.clone(), a4.clone()),v.clone()));
                    };
                    let d = __rDeltaLogicalRouter.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LogicalRouter(a1.clone(), a2.clone(), a3.clone(), a4.clone()),v.clone()));
                    };
                    let d = __rDeltaLogicalRouterPort.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4,ref a5,ref a6,ref a7,ref a8),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LogicalRouterPort(a1.clone(), a2.clone(), a3.clone(), a4.clone(), a5.clone(), a6.clone(), a7.clone(), a8.clone()),v.clone()));
                    };
                    let d = __rDeltaDHCPv4Options.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::DHCPv4Options(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDeltaDHCPv6Options.borrow();
                    for (&(ref a1,ref a2,ref a3),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::DHCPv6Options(a1.clone(), a2.clone(), a3.clone()),v.clone()));
                    };
                    let d = __rDeltaPhysicalNetwork.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::PhysicalNetwork(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDeltaLogicalSwitchPort.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4,ref a5,ref a6,ref a7,ref a8,ref a9),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LogicalSwitchPort(a1.clone(), a2.clone(), a3.clone(), a4.clone(), a5.clone(), a6.clone(), a7.clone(), a8.clone(), a9.clone()),v.clone()));
                    };
                    let d = __rDeltaLogicalSwitchPortMAC.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LogicalSwitchPortMAC(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDeltaLogicalSwitchPortIP.borrow();
                    for (&(ref a1,ref a2,ref a3),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LogicalSwitchPortIP(a1.clone(), a2.clone(), a3.clone()),v.clone()));
                    };
                    let d = __rDeltaLogicalSwitchPortDynAddr.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LogicalSwitchPortDynAddr(a1.clone(), a2.clone(), a3.clone(), a4.clone()),v.clone()));
                    };
                    let d = __rDeltaVSwitchPort.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::VSwitchPort(a1.clone(), a2.clone(), a3.clone(), a4.clone()),v.clone()));
                    };
                    let d = __rDeltaLPortBinding.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LPortBinding(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDeltaPortSecurityMAC.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::PortSecurityMAC(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDeltaPortSecurityIP.borrow();
                    for (&(ref a1,ref a2,ref a3),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::PortSecurityIP(a1.clone(), a2.clone(), a3.clone()),v.clone()));
                    };
                    let d = __rDeltaAddressSet.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::AddressSet(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDeltaAddressSetAddr.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::AddressSetAddr(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDeltaLoadBalancer.borrow();
                    for (&(ref a1,ref a2,ref a3),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LoadBalancer(a1.clone(), a2.clone(), a3.clone()),v.clone()));
                    };
                    let d = __rDeltaLBSwitch.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LBSwitch(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDeltaLBVIP.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LBVIP(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDeltaLBIP.borrow();
                    for (&(ref a1,ref a2,ref a3),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LBIP(a1.clone(), a2.clone(), a3.clone()),v.clone()));
                    };
                    let d = __rDeltaACL.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4,ref a5),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::ACL(a1.clone(), a2.clone(), a3.clone(), a4.clone(), a5.clone()),v.clone()));
                    };
                    let d = __rDeltaLBRouter.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LBRouter(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDeltaLRouterPortNetwork.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LRouterPortNetwork(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDeltaLogicalRouterStaticRoute.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LogicalRouterStaticRoute(a1.clone(), a2.clone(), a3.clone(), a4.clone()),v.clone()));
                    };
                    let d = __rDeltaNAT.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4,ref a5,ref a6),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::NAT(a1.clone(), a2.clone(), a3.clone(), a4.clone(), a5.clone(), a6.clone()),v.clone()));
                    };
                    let d = __rDeltaLearnedAddress.borrow();
                    for (&(ref a1,ref a2,ref a3),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::LearnedAddress(a1.clone(), a2.clone(), a3.clone()),v.clone()));
                    };
                    let d = __rDeltaTunnelPort.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::TunnelPort(a1.clone(), a2.clone(), a3.clone(), a4.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_VSwitchPort.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_VSwitchPort(a1.clone(), a2.clone(), a3.clone(), a4.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LPortBinding.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LPortBinding(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LogicalSwitchPort.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4,ref a5,ref a6,ref a7,ref a8,ref a9),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LogicalSwitchPort(a1.clone(), a2.clone(), a3.clone(), a4.clone(), a5.clone(), a6.clone(), a7.clone(), a8.clone(), a9.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_PortSecurityType.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_PortSecurityType(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_PortSecurityMAC.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_PortSecurityMAC(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LPortStatefulACL.borrow();
                    for (a1,v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LPortStatefulACL(a1.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LPortLBVIP.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LPortLBVIP(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_ACL.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4,ref a5),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_ACL(a1.clone(), a2.clone(), a3.clone(), a4.clone(), a5.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LPortLBVIPIP.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LPortLBVIPIP(a1.clone(), a2.clone(), a3.clone(), a4.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LPortMACIP.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LPortMACIP(a1.clone(), a2.clone(), a3.clone(), a4.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LPortDHCP4AddrOpts.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LPortDHCP4AddrOpts(a1.clone(), a2.clone(), a3.clone(), a4.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LPortDHCP6AddrOpts.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4,ref a5),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LPortDHCP6AddrOpts(a1.clone(), a2.clone(), a3.clone(), a4.clone(), a5.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LSwitchAtChassis.borrow();
                    for (&(ref a1,ref a2,ref a3),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LSwitchAtChassis(a1.clone(), a2.clone(), a3.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_MACChassis.borrow();
                    for (&(ref a1,ref a2,ref a3),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_MACChassis(a1.clone(), a2.clone(), a3.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_UnknownMACChassis.borrow();
                    for (&(ref a1,ref a2,ref a3),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_UnknownMACChassis(a1.clone(), a2.clone(), a3.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_PortSecurityIP4Match.borrow();
                    for (&(ref a1,ref a2,ref a3),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_PortSecurityIP4Match(a1.clone(), a2.clone(), a3.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_PortSecurityIP.borrow();
                    for (&(ref a1,ref a2,ref a3),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_PortSecurityIP(a1.clone(), a2.clone(), a3.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_PortSecurityIP6Match.borrow();
                    for (&(ref a1,ref a2,ref a3),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_PortSecurityIP6Match(a1.clone(), a2.clone(), a3.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LogicalRouterPort.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4,ref a5,ref a6,ref a7,ref a8),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LogicalRouterPort(a1.clone(), a2.clone(), a3.clone(), a4.clone(), a5.clone(), a6.clone(), a7.clone(), a8.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_NATChassis.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4,ref a5,ref a6,ref a7),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_NATChassis(a1.clone(), a2.clone(), a3.clone(), a4.clone(), a5.clone(), a6.clone(), a7.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LRouterNetwork.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LRouterNetwork(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LRouterPortNetwork.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LRouterPortNetwork(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LRouterLBVIP.borrow();
                    for (&(ref a1,ref a2),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LRouterLBVIP(a1.clone(), a2.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_NAT.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4,ref a5,ref a6),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_NAT(a1.clone(), a2.clone(), a3.clone(), a4.clone(), a5.clone(), a6.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LearnedAddress.borrow();
                    for (&(ref a1,ref a2,ref a3),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LearnedAddress(a1.clone(), a2.clone(), a3.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_TunnelFromTo.borrow();
                    for (&(ref a1,ref a2,ref a3),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_TunnelFromTo(a1.clone(), a2.clone(), a3.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_TunnelPort.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_TunnelPort(a1.clone(), a2.clone(), a3.clone(), a4.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_Route.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4,ref a5,ref a6),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_Route(a1.clone(), a2.clone(), a3.clone(), a4.clone(), a5.clone(), a6.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LPortAtChassis.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LPortAtChassis(a1.clone(), a2.clone(), a3.clone(), a4.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LPortMACChassis.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4,ref a5),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LPortMACChassis(a1.clone(), a2.clone(), a3.clone(), a4.clone(), a5.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LPortUnknownMACChassis.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LPortUnknownMACChassis(a1.clone(), a2.clone(), a3.clone(), a4.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_LPortLB.borrow();
                    for (a1,v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_LPortLB(a1.clone()),v.clone()));
                    };
                    let d = __rDelta_realized_Chassis.borrow();
                    for (&(ref a1,ref a2,ref a3,ref a4),v) in d.iter().filter(|&(_, v)| *v != 0) {
                        $delta.insert((Fact::_realized_Chassis(a1.clone(), a2.clone(), a3.clone(), a4.clone()),v.clone()));
                    };
                }}
            }
            macro_rules! delta_cleanup {
                () => {{
                    __rDeltaLogicalSwitch.borrow_mut().clear();
                    __rDeltaChassis.borrow_mut().clear();
                    __rDeltaLogicalRouter.borrow_mut().clear();
                    __rDeltaLogicalRouterPort.borrow_mut().clear();
                    __rDeltaDHCPv4Options.borrow_mut().clear();
                    __rDeltaDHCPv6Options.borrow_mut().clear();
                    __rDeltaPhysicalNetwork.borrow_mut().clear();
                    __rDeltaLogicalSwitchPort.borrow_mut().clear();
                    __rDeltaLogicalSwitchPortMAC.borrow_mut().clear();
                    __rDeltaLogicalSwitchPortIP.borrow_mut().clear();
                    __rDeltaLogicalSwitchPortDynAddr.borrow_mut().clear();
                    __rDeltaVSwitchPort.borrow_mut().clear();
                    __rDeltaLPortBinding.borrow_mut().clear();
                    __rDeltaPortSecurityMAC.borrow_mut().clear();
                    __rDeltaPortSecurityIP.borrow_mut().clear();
                    __rDeltaAddressSet.borrow_mut().clear();
                    __rDeltaAddressSetAddr.borrow_mut().clear();
                    __rDeltaLoadBalancer.borrow_mut().clear();
                    __rDeltaLBSwitch.borrow_mut().clear();
                    __rDeltaLBVIP.borrow_mut().clear();
                    __rDeltaLBIP.borrow_mut().clear();
                    __rDeltaACL.borrow_mut().clear();
                    __rDeltaLBRouter.borrow_mut().clear();
                    __rDeltaLRouterPortNetwork.borrow_mut().clear();
                    __rDeltaLogicalRouterStaticRoute.borrow_mut().clear();
                    __rDeltaNAT.borrow_mut().clear();
                    __rDeltaLearnedAddress.borrow_mut().clear();
                    __rDeltaTunnelPort.borrow_mut().clear();
                    __rDelta_realized_VSwitchPort.borrow_mut().clear();
                    __rDelta_realized_LPortBinding.borrow_mut().clear();
                    __rDelta_realized_LogicalSwitchPort.borrow_mut().clear();
                    __rDelta_realized_PortSecurityType.borrow_mut().clear();
                    __rDelta_realized_PortSecurityMAC.borrow_mut().clear();
                    __rDelta_realized_LPortStatefulACL.borrow_mut().clear();
                    __rDelta_realized_LPortLBVIP.borrow_mut().clear();
                    __rDelta_realized_ACL.borrow_mut().clear();
                    __rDelta_realized_LPortLBVIPIP.borrow_mut().clear();
                    __rDelta_realized_LPortMACIP.borrow_mut().clear();
                    __rDelta_realized_LPortDHCP4AddrOpts.borrow_mut().clear();
                    __rDelta_realized_LPortDHCP6AddrOpts.borrow_mut().clear();
                    __rDelta_realized_LSwitchAtChassis.borrow_mut().clear();
                    __rDelta_realized_MACChassis.borrow_mut().clear();
                    __rDelta_realized_UnknownMACChassis.borrow_mut().clear();
                    __rDelta_realized_PortSecurityIP4Match.borrow_mut().clear();
                    __rDelta_realized_PortSecurityIP.borrow_mut().clear();
                    __rDelta_realized_PortSecurityIP6Match.borrow_mut().clear();
                    __rDelta_realized_LogicalRouterPort.borrow_mut().clear();
                    __rDelta_realized_NATChassis.borrow_mut().clear();
                    __rDelta_realized_LRouterNetwork.borrow_mut().clear();
                    __rDelta_realized_LRouterPortNetwork.borrow_mut().clear();
                    __rDelta_realized_LRouterLBVIP.borrow_mut().clear();
                    __rDelta_realized_NAT.borrow_mut().clear();
                    __rDelta_realized_LearnedAddress.borrow_mut().clear();
                    __rDelta_realized_TunnelFromTo.borrow_mut().clear();
                    __rDelta_realized_TunnelPort.borrow_mut().clear();
                    __rDelta_realized_Route.borrow_mut().clear();
                    __rDelta_realized_LPortAtChassis.borrow_mut().clear();
                    __rDelta_realized_LPortMACChassis.borrow_mut().clear();
                    __rDelta_realized_LPortUnknownMACChassis.borrow_mut().clear();
                    __rDelta_realized_LPortLB.borrow_mut().clear();
                    __rDelta_realized_Chassis.borrow_mut().clear();
                }}
            }
            macro_rules! delta_undo {
                () => {{
                    let mut d = __rDeltaLogicalSwitch.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LogicalSwitch, _rLogicalSwitch, k);
                        } else if v == -1 {
                            insert!(_LogicalSwitch, _rLogicalSwitch, k);
                        };
                    };
                    let mut d = __rDeltaChassis.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_Chassis, _rChassis, k);
                        } else if v == -1 {
                            insert!(_Chassis, _rChassis, k);
                        };
                    };
                    let mut d = __rDeltaLogicalRouter.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LogicalRouter, _rLogicalRouter, k);
                        } else if v == -1 {
                            insert!(_LogicalRouter, _rLogicalRouter, k);
                        };
                    };
                    let mut d = __rDeltaLogicalRouterPort.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LogicalRouterPort, _rLogicalRouterPort, k);
                        } else if v == -1 {
                            insert!(_LogicalRouterPort, _rLogicalRouterPort, k);
                        };
                    };
                    let mut d = __rDeltaDHCPv4Options.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_DHCPv4Options, _rDHCPv4Options, k);
                        } else if v == -1 {
                            insert!(_DHCPv4Options, _rDHCPv4Options, k);
                        };
                    };
                    let mut d = __rDeltaDHCPv6Options.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_DHCPv6Options, _rDHCPv6Options, k);
                        } else if v == -1 {
                            insert!(_DHCPv6Options, _rDHCPv6Options, k);
                        };
                    };
                    let mut d = __rDeltaPhysicalNetwork.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_PhysicalNetwork, _rPhysicalNetwork, k);
                        } else if v == -1 {
                            insert!(_PhysicalNetwork, _rPhysicalNetwork, k);
                        };
                    };
                    let mut d = __rDeltaLogicalSwitchPort.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LogicalSwitchPort, _rLogicalSwitchPort, k);
                        } else if v == -1 {
                            insert!(_LogicalSwitchPort, _rLogicalSwitchPort, k);
                        };
                    };
                    let mut d = __rDeltaLogicalSwitchPortMAC.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LogicalSwitchPortMAC, _rLogicalSwitchPortMAC, k);
                        } else if v == -1 {
                            insert!(_LogicalSwitchPortMAC, _rLogicalSwitchPortMAC, k);
                        };
                    };
                    let mut d = __rDeltaLogicalSwitchPortIP.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LogicalSwitchPortIP, _rLogicalSwitchPortIP, k);
                        } else if v == -1 {
                            insert!(_LogicalSwitchPortIP, _rLogicalSwitchPortIP, k);
                        };
                    };
                    let mut d = __rDeltaLogicalSwitchPortDynAddr.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LogicalSwitchPortDynAddr, _rLogicalSwitchPortDynAddr, k);
                        } else if v == -1 {
                            insert!(_LogicalSwitchPortDynAddr, _rLogicalSwitchPortDynAddr, k);
                        };
                    };
                    let mut d = __rDeltaVSwitchPort.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_VSwitchPort, _rVSwitchPort, k);
                        } else if v == -1 {
                            insert!(_VSwitchPort, _rVSwitchPort, k);
                        };
                    };
                    let mut d = __rDeltaLPortBinding.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LPortBinding, _rLPortBinding, k);
                        } else if v == -1 {
                            insert!(_LPortBinding, _rLPortBinding, k);
                        };
                    };
                    let mut d = __rDeltaPortSecurityMAC.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_PortSecurityMAC, _rPortSecurityMAC, k);
                        } else if v == -1 {
                            insert!(_PortSecurityMAC, _rPortSecurityMAC, k);
                        };
                    };
                    let mut d = __rDeltaPortSecurityIP.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_PortSecurityIP, _rPortSecurityIP, k);
                        } else if v == -1 {
                            insert!(_PortSecurityIP, _rPortSecurityIP, k);
                        };
                    };
                    let mut d = __rDeltaAddressSet.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_AddressSet, _rAddressSet, k);
                        } else if v == -1 {
                            insert!(_AddressSet, _rAddressSet, k);
                        };
                    };
                    let mut d = __rDeltaAddressSetAddr.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_AddressSetAddr, _rAddressSetAddr, k);
                        } else if v == -1 {
                            insert!(_AddressSetAddr, _rAddressSetAddr, k);
                        };
                    };
                    let mut d = __rDeltaLoadBalancer.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LoadBalancer, _rLoadBalancer, k);
                        } else if v == -1 {
                            insert!(_LoadBalancer, _rLoadBalancer, k);
                        };
                    };
                    let mut d = __rDeltaLBSwitch.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LBSwitch, _rLBSwitch, k);
                        } else if v == -1 {
                            insert!(_LBSwitch, _rLBSwitch, k);
                        };
                    };
                    let mut d = __rDeltaLBVIP.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LBVIP, _rLBVIP, k);
                        } else if v == -1 {
                            insert!(_LBVIP, _rLBVIP, k);
                        };
                    };
                    let mut d = __rDeltaLBIP.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LBIP, _rLBIP, k);
                        } else if v == -1 {
                            insert!(_LBIP, _rLBIP, k);
                        };
                    };
                    let mut d = __rDeltaACL.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_ACL, _rACL, k);
                        } else if v == -1 {
                            insert!(_ACL, _rACL, k);
                        };
                    };
                    let mut d = __rDeltaLBRouter.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LBRouter, _rLBRouter, k);
                        } else if v == -1 {
                            insert!(_LBRouter, _rLBRouter, k);
                        };
                    };
                    let mut d = __rDeltaLRouterPortNetwork.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LRouterPortNetwork, _rLRouterPortNetwork, k);
                        } else if v == -1 {
                            insert!(_LRouterPortNetwork, _rLRouterPortNetwork, k);
                        };
                    };
                    let mut d = __rDeltaLogicalRouterStaticRoute.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LogicalRouterStaticRoute, _rLogicalRouterStaticRoute, k);
                        } else if v == -1 {
                            insert!(_LogicalRouterStaticRoute, _rLogicalRouterStaticRoute, k);
                        };
                    };
                    let mut d = __rDeltaNAT.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_NAT, _rNAT, k);
                        } else if v == -1 {
                            insert!(_NAT, _rNAT, k);
                        };
                    };
                    let mut d = __rDeltaLearnedAddress.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_LearnedAddress, _rLearnedAddress, k);
                        } else if v == -1 {
                            insert!(_LearnedAddress, _rLearnedAddress, k);
                        };
                    };
                    let mut d = __rDeltaTunnelPort.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(_TunnelPort, _rTunnelPort, k);
                        } else if v == -1 {
                            insert!(_TunnelPort, _rTunnelPort, k);
                        };
                    };
                    let mut d = __rDelta_realized_VSwitchPort.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_VSwitchPort, _r_realized_VSwitchPort, k);
                        } else if v == -1 {
                            insert!(__realized_VSwitchPort, _r_realized_VSwitchPort, k);
                        };
                    };
                    let mut d = __rDelta_realized_LPortBinding.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LPortBinding, _r_realized_LPortBinding, k);
                        } else if v == -1 {
                            insert!(__realized_LPortBinding, _r_realized_LPortBinding, k);
                        };
                    };
                    let mut d = __rDelta_realized_LogicalSwitchPort.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LogicalSwitchPort, _r_realized_LogicalSwitchPort, k);
                        } else if v == -1 {
                            insert!(__realized_LogicalSwitchPort, _r_realized_LogicalSwitchPort, k);
                        };
                    };
                    let mut d = __rDelta_realized_PortSecurityType.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_PortSecurityType, _r_realized_PortSecurityType, k);
                        } else if v == -1 {
                            insert!(__realized_PortSecurityType, _r_realized_PortSecurityType, k);
                        };
                    };
                    let mut d = __rDelta_realized_PortSecurityMAC.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_PortSecurityMAC, _r_realized_PortSecurityMAC, k);
                        } else if v == -1 {
                            insert!(__realized_PortSecurityMAC, _r_realized_PortSecurityMAC, k);
                        };
                    };
                    let mut d = __rDelta_realized_LPortStatefulACL.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LPortStatefulACL, _r_realized_LPortStatefulACL, k);
                        } else if v == -1 {
                            insert!(__realized_LPortStatefulACL, _r_realized_LPortStatefulACL, k);
                        };
                    };
                    let mut d = __rDelta_realized_LPortLBVIP.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LPortLBVIP, _r_realized_LPortLBVIP, k);
                        } else if v == -1 {
                            insert!(__realized_LPortLBVIP, _r_realized_LPortLBVIP, k);
                        };
                    };
                    let mut d = __rDelta_realized_ACL.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_ACL, _r_realized_ACL, k);
                        } else if v == -1 {
                            insert!(__realized_ACL, _r_realized_ACL, k);
                        };
                    };
                    let mut d = __rDelta_realized_LPortLBVIPIP.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LPortLBVIPIP, _r_realized_LPortLBVIPIP, k);
                        } else if v == -1 {
                            insert!(__realized_LPortLBVIPIP, _r_realized_LPortLBVIPIP, k);
                        };
                    };
                    let mut d = __rDelta_realized_LPortMACIP.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LPortMACIP, _r_realized_LPortMACIP, k);
                        } else if v == -1 {
                            insert!(__realized_LPortMACIP, _r_realized_LPortMACIP, k);
                        };
                    };
                    let mut d = __rDelta_realized_LPortDHCP4AddrOpts.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LPortDHCP4AddrOpts, _r_realized_LPortDHCP4AddrOpts, k);
                        } else if v == -1 {
                            insert!(__realized_LPortDHCP4AddrOpts, _r_realized_LPortDHCP4AddrOpts, k);
                        };
                    };
                    let mut d = __rDelta_realized_LPortDHCP6AddrOpts.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LPortDHCP6AddrOpts, _r_realized_LPortDHCP6AddrOpts, k);
                        } else if v == -1 {
                            insert!(__realized_LPortDHCP6AddrOpts, _r_realized_LPortDHCP6AddrOpts, k);
                        };
                    };
                    let mut d = __rDelta_realized_LSwitchAtChassis.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LSwitchAtChassis, _r_realized_LSwitchAtChassis, k);
                        } else if v == -1 {
                            insert!(__realized_LSwitchAtChassis, _r_realized_LSwitchAtChassis, k);
                        };
                    };
                    let mut d = __rDelta_realized_MACChassis.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_MACChassis, _r_realized_MACChassis, k);
                        } else if v == -1 {
                            insert!(__realized_MACChassis, _r_realized_MACChassis, k);
                        };
                    };
                    let mut d = __rDelta_realized_UnknownMACChassis.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_UnknownMACChassis, _r_realized_UnknownMACChassis, k);
                        } else if v == -1 {
                            insert!(__realized_UnknownMACChassis, _r_realized_UnknownMACChassis, k);
                        };
                    };
                    let mut d = __rDelta_realized_PortSecurityIP4Match.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_PortSecurityIP4Match, _r_realized_PortSecurityIP4Match, k);
                        } else if v == -1 {
                            insert!(__realized_PortSecurityIP4Match, _r_realized_PortSecurityIP4Match, k);
                        };
                    };
                    let mut d = __rDelta_realized_PortSecurityIP.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_PortSecurityIP, _r_realized_PortSecurityIP, k);
                        } else if v == -1 {
                            insert!(__realized_PortSecurityIP, _r_realized_PortSecurityIP, k);
                        };
                    };
                    let mut d = __rDelta_realized_PortSecurityIP6Match.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_PortSecurityIP6Match, _r_realized_PortSecurityIP6Match, k);
                        } else if v == -1 {
                            insert!(__realized_PortSecurityIP6Match, _r_realized_PortSecurityIP6Match, k);
                        };
                    };
                    let mut d = __rDelta_realized_LogicalRouterPort.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LogicalRouterPort, _r_realized_LogicalRouterPort, k);
                        } else if v == -1 {
                            insert!(__realized_LogicalRouterPort, _r_realized_LogicalRouterPort, k);
                        };
                    };
                    let mut d = __rDelta_realized_NATChassis.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_NATChassis, _r_realized_NATChassis, k);
                        } else if v == -1 {
                            insert!(__realized_NATChassis, _r_realized_NATChassis, k);
                        };
                    };
                    let mut d = __rDelta_realized_LRouterNetwork.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LRouterNetwork, _r_realized_LRouterNetwork, k);
                        } else if v == -1 {
                            insert!(__realized_LRouterNetwork, _r_realized_LRouterNetwork, k);
                        };
                    };
                    let mut d = __rDelta_realized_LRouterPortNetwork.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LRouterPortNetwork, _r_realized_LRouterPortNetwork, k);
                        } else if v == -1 {
                            insert!(__realized_LRouterPortNetwork, _r_realized_LRouterPortNetwork, k);
                        };
                    };
                    let mut d = __rDelta_realized_LRouterLBVIP.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LRouterLBVIP, _r_realized_LRouterLBVIP, k);
                        } else if v == -1 {
                            insert!(__realized_LRouterLBVIP, _r_realized_LRouterLBVIP, k);
                        };
                    };
                    let mut d = __rDelta_realized_NAT.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_NAT, _r_realized_NAT, k);
                        } else if v == -1 {
                            insert!(__realized_NAT, _r_realized_NAT, k);
                        };
                    };
                    let mut d = __rDelta_realized_LearnedAddress.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LearnedAddress, _r_realized_LearnedAddress, k);
                        } else if v == -1 {
                            insert!(__realized_LearnedAddress, _r_realized_LearnedAddress, k);
                        };
                    };
                    let mut d = __rDelta_realized_TunnelFromTo.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_TunnelFromTo, _r_realized_TunnelFromTo, k);
                        } else if v == -1 {
                            insert!(__realized_TunnelFromTo, _r_realized_TunnelFromTo, k);
                        };
                    };
                    let mut d = __rDelta_realized_TunnelPort.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_TunnelPort, _r_realized_TunnelPort, k);
                        } else if v == -1 {
                            insert!(__realized_TunnelPort, _r_realized_TunnelPort, k);
                        };
                    };
                    let mut d = __rDelta_realized_Route.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_Route, _r_realized_Route, k);
                        } else if v == -1 {
                            insert!(__realized_Route, _r_realized_Route, k);
                        };
                    };
                    let mut d = __rDelta_realized_LPortAtChassis.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LPortAtChassis, _r_realized_LPortAtChassis, k);
                        } else if v == -1 {
                            insert!(__realized_LPortAtChassis, _r_realized_LPortAtChassis, k);
                        };
                    };
                    let mut d = __rDelta_realized_LPortMACChassis.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LPortMACChassis, _r_realized_LPortMACChassis, k);
                        } else if v == -1 {
                            insert!(__realized_LPortMACChassis, _r_realized_LPortMACChassis, k);
                        };
                    };
                    let mut d = __rDelta_realized_LPortUnknownMACChassis.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LPortUnknownMACChassis, _r_realized_LPortUnknownMACChassis, k);
                        } else if v == -1 {
                            insert!(__realized_LPortUnknownMACChassis, _r_realized_LPortUnknownMACChassis, k);
                        };
                    };
                    let mut d = __rDelta_realized_LPortLB.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_LPortLB, _r_realized_LPortLB, k);
                        } else if v == -1 {
                            insert!(__realized_LPortLB, _r_realized_LPortLB, k);
                        };
                    };
                    let mut d = __rDelta_realized_Chassis.borrow().clone();
                    for (k,v) in d.drain() {
                        if v == 1 {
                            remove!(__realized_Chassis, _r_realized_Chassis, k);
                        } else if v == -1 {
                            insert!(__realized_Chassis, _r_realized_Chassis, k);
                        };
                    };
               }}
            }

            match req {
                Request::start                       => {
                    let resp = if xaction {
                                   Response::err(format!("transaction already in progress"))
                               } else {
                                   delta_cleanup!();
                                   xaction = true;
                                   Response::ok(())
                               };
                    serde_json::to_writer(stdout(), &resp).unwrap();
                    stdout().flush().unwrap();
                },
                Request::rollback                    => {
                    let resp = if !xaction {
                                   Response::err(format!("no transaction in progress"))
                               } else {
                                   delta_undo!();
                                   delta_cleanup!();
                                   xaction = false;
                                   Response::ok(())
                               };
                    serde_json::to_writer(stdout(), &resp).unwrap();
                    stdout().flush().unwrap();
                },
                Request::commit                      => {
                    let resp = if !xaction {
                                   Response::err(format!("no transaction in progress"))
                               } else {
                                   let mut delta = HashSet::new();
                                   delta!(delta);
                                   delta_cleanup!();
                                   xaction = false;
                                   Response::ok(delta)
                               };
                    serde_json::to_writer(stdout(), &resp).unwrap();
                    stdout().flush().unwrap();
                },
                Request::add(Fact::LogicalSwitch(a0,a1,a2,a3)) => insert_resp!(_LogicalSwitch, _rLogicalSwitch, (a0,a1,a2,a3)),
                Request::del(Fact::LogicalSwitch(a0,a1,a2,a3)) => remove_resp!(_LogicalSwitch, _rLogicalSwitch, (a0,a1,a2,a3)),
                Request::chk(Relation::LogicalSwitch) => check!(_rLogicalSwitch),
                Request::enm(Relation::LogicalSwitch) => enm!(_rLogicalSwitch),
                Request::add(Fact::Chassis(a0,a1,a2,a3)) => insert_resp!(_Chassis, _rChassis, (a0,a1,a2,a3)),
                Request::del(Fact::Chassis(a0,a1,a2,a3)) => remove_resp!(_Chassis, _rChassis, (a0,a1,a2,a3)),
                Request::chk(Relation::Chassis) => check!(_rChassis),
                Request::enm(Relation::Chassis) => enm!(_rChassis),
                Request::add(Fact::LogicalRouter(a0,a1,a2,a3)) => insert_resp!(_LogicalRouter, _rLogicalRouter, (a0,a1,a2,a3)),
                Request::del(Fact::LogicalRouter(a0,a1,a2,a3)) => remove_resp!(_LogicalRouter, _rLogicalRouter, (a0,a1,a2,a3)),
                Request::chk(Relation::LogicalRouter) => check!(_rLogicalRouter),
                Request::enm(Relation::LogicalRouter) => enm!(_rLogicalRouter),
                Request::add(Fact::LogicalRouterPort(a0,a1,a2,a3,a4,a5,a6,a7)) => insert_resp!(_LogicalRouterPort, _rLogicalRouterPort, (a0,a1,a2,a3,a4,a5,a6,a7)),
                Request::del(Fact::LogicalRouterPort(a0,a1,a2,a3,a4,a5,a6,a7)) => remove_resp!(_LogicalRouterPort, _rLogicalRouterPort, (a0,a1,a2,a3,a4,a5,a6,a7)),
                Request::chk(Relation::LogicalRouterPort) => check!(_rLogicalRouterPort),
                Request::enm(Relation::LogicalRouterPort) => enm!(_rLogicalRouterPort),
                Request::add(Fact::DHCPv4Options(a0,a1)) => insert_resp!(_DHCPv4Options, _rDHCPv4Options, (a0,a1)),
                Request::del(Fact::DHCPv4Options(a0,a1)) => remove_resp!(_DHCPv4Options, _rDHCPv4Options, (a0,a1)),
                Request::chk(Relation::DHCPv4Options) => check!(_rDHCPv4Options),
                Request::enm(Relation::DHCPv4Options) => enm!(_rDHCPv4Options),
                Request::add(Fact::DHCPv6Options(a0,a1,a2)) => insert_resp!(_DHCPv6Options, _rDHCPv6Options, (a0,a1,a2)),
                Request::del(Fact::DHCPv6Options(a0,a1,a2)) => remove_resp!(_DHCPv6Options, _rDHCPv6Options, (a0,a1,a2)),
                Request::chk(Relation::DHCPv6Options) => check!(_rDHCPv6Options),
                Request::enm(Relation::DHCPv6Options) => enm!(_rDHCPv6Options),
                Request::add(Fact::PhysicalNetwork(a0,a1)) => insert_resp!(_PhysicalNetwork, _rPhysicalNetwork, (a0,a1)),
                Request::del(Fact::PhysicalNetwork(a0,a1)) => remove_resp!(_PhysicalNetwork, _rPhysicalNetwork, (a0,a1)),
                Request::chk(Relation::PhysicalNetwork) => check!(_rPhysicalNetwork),
                Request::enm(Relation::PhysicalNetwork) => enm!(_rPhysicalNetwork),
                Request::add(Fact::LogicalSwitchPort(a0,a1,a2,a3,a4,a5,a6,a7,a8)) => insert_resp!(_LogicalSwitchPort, _rLogicalSwitchPort, (a0,a1,a2,a3,a4,a5,a6,a7,a8)),
                Request::del(Fact::LogicalSwitchPort(a0,a1,a2,a3,a4,a5,a6,a7,a8)) => remove_resp!(_LogicalSwitchPort, _rLogicalSwitchPort, (a0,a1,a2,a3,a4,a5,a6,a7,a8)),
                Request::chk(Relation::LogicalSwitchPort) => check!(_rLogicalSwitchPort),
                Request::enm(Relation::LogicalSwitchPort) => enm!(_rLogicalSwitchPort),
                Request::add(Fact::LogicalSwitchPortMAC(a0,a1)) => insert_resp!(_LogicalSwitchPortMAC, _rLogicalSwitchPortMAC, (a0,a1)),
                Request::del(Fact::LogicalSwitchPortMAC(a0,a1)) => remove_resp!(_LogicalSwitchPortMAC, _rLogicalSwitchPortMAC, (a0,a1)),
                Request::chk(Relation::LogicalSwitchPortMAC) => check!(_rLogicalSwitchPortMAC),
                Request::enm(Relation::LogicalSwitchPortMAC) => enm!(_rLogicalSwitchPortMAC),
                Request::add(Fact::LogicalSwitchPortIP(a0,a1,a2)) => insert_resp!(_LogicalSwitchPortIP, _rLogicalSwitchPortIP, (a0,a1,a2)),
                Request::del(Fact::LogicalSwitchPortIP(a0,a1,a2)) => remove_resp!(_LogicalSwitchPortIP, _rLogicalSwitchPortIP, (a0,a1,a2)),
                Request::chk(Relation::LogicalSwitchPortIP) => check!(_rLogicalSwitchPortIP),
                Request::enm(Relation::LogicalSwitchPortIP) => enm!(_rLogicalSwitchPortIP),
                Request::add(Fact::LogicalSwitchPortDynAddr(a0,a1,a2,a3)) => insert_resp!(_LogicalSwitchPortDynAddr, _rLogicalSwitchPortDynAddr, (a0,a1,a2,a3)),
                Request::del(Fact::LogicalSwitchPortDynAddr(a0,a1,a2,a3)) => remove_resp!(_LogicalSwitchPortDynAddr, _rLogicalSwitchPortDynAddr, (a0,a1,a2,a3)),
                Request::chk(Relation::LogicalSwitchPortDynAddr) => check!(_rLogicalSwitchPortDynAddr),
                Request::enm(Relation::LogicalSwitchPortDynAddr) => enm!(_rLogicalSwitchPortDynAddr),
                Request::add(Fact::VSwitchPort(a0,a1,a2,a3)) => insert_resp!(_VSwitchPort, _rVSwitchPort, (a0,a1,a2,a3)),
                Request::del(Fact::VSwitchPort(a0,a1,a2,a3)) => remove_resp!(_VSwitchPort, _rVSwitchPort, (a0,a1,a2,a3)),
                Request::chk(Relation::VSwitchPort) => check!(_rVSwitchPort),
                Request::enm(Relation::VSwitchPort) => enm!(_rVSwitchPort),
                Request::add(Fact::LPortBinding(a0,a1)) => insert_resp!(_LPortBinding, _rLPortBinding, (a0,a1)),
                Request::del(Fact::LPortBinding(a0,a1)) => remove_resp!(_LPortBinding, _rLPortBinding, (a0,a1)),
                Request::chk(Relation::LPortBinding) => check!(_rLPortBinding),
                Request::enm(Relation::LPortBinding) => enm!(_rLPortBinding),
                Request::add(Fact::PortSecurityMAC(a0,a1)) => insert_resp!(_PortSecurityMAC, _rPortSecurityMAC, (a0,a1)),
                Request::del(Fact::PortSecurityMAC(a0,a1)) => remove_resp!(_PortSecurityMAC, _rPortSecurityMAC, (a0,a1)),
                Request::chk(Relation::PortSecurityMAC) => check!(_rPortSecurityMAC),
                Request::enm(Relation::PortSecurityMAC) => enm!(_rPortSecurityMAC),
                Request::add(Fact::PortSecurityIP(a0,a1,a2)) => insert_resp!(_PortSecurityIP, _rPortSecurityIP, (a0,a1,a2)),
                Request::del(Fact::PortSecurityIP(a0,a1,a2)) => remove_resp!(_PortSecurityIP, _rPortSecurityIP, (a0,a1,a2)),
                Request::chk(Relation::PortSecurityIP) => check!(_rPortSecurityIP),
                Request::enm(Relation::PortSecurityIP) => enm!(_rPortSecurityIP),
                Request::add(Fact::AddressSet(a0,a1)) => insert_resp!(_AddressSet, _rAddressSet, (a0,a1)),
                Request::del(Fact::AddressSet(a0,a1)) => remove_resp!(_AddressSet, _rAddressSet, (a0,a1)),
                Request::chk(Relation::AddressSet) => check!(_rAddressSet),
                Request::enm(Relation::AddressSet) => enm!(_rAddressSet),
                Request::add(Fact::AddressSetAddr(a0,a1)) => insert_resp!(_AddressSetAddr, _rAddressSetAddr, (a0,a1)),
                Request::del(Fact::AddressSetAddr(a0,a1)) => remove_resp!(_AddressSetAddr, _rAddressSetAddr, (a0,a1)),
                Request::chk(Relation::AddressSetAddr) => check!(_rAddressSetAddr),
                Request::enm(Relation::AddressSetAddr) => enm!(_rAddressSetAddr),
                Request::add(Fact::LoadBalancer(a0,a1,a2)) => insert_resp!(_LoadBalancer, _rLoadBalancer, (a0,a1,a2)),
                Request::del(Fact::LoadBalancer(a0,a1,a2)) => remove_resp!(_LoadBalancer, _rLoadBalancer, (a0,a1,a2)),
                Request::chk(Relation::LoadBalancer) => check!(_rLoadBalancer),
                Request::enm(Relation::LoadBalancer) => enm!(_rLoadBalancer),
                Request::add(Fact::LBSwitch(a0,a1)) => insert_resp!(_LBSwitch, _rLBSwitch, (a0,a1)),
                Request::del(Fact::LBSwitch(a0,a1)) => remove_resp!(_LBSwitch, _rLBSwitch, (a0,a1)),
                Request::chk(Relation::LBSwitch) => check!(_rLBSwitch),
                Request::enm(Relation::LBSwitch) => enm!(_rLBSwitch),
                Request::add(Fact::LBVIP(a0,a1)) => insert_resp!(_LBVIP, _rLBVIP, (a0,a1)),
                Request::del(Fact::LBVIP(a0,a1)) => remove_resp!(_LBVIP, _rLBVIP, (a0,a1)),
                Request::chk(Relation::LBVIP) => check!(_rLBVIP),
                Request::enm(Relation::LBVIP) => enm!(_rLBVIP),
                Request::add(Fact::LBIP(a0,a1,a2)) => insert_resp!(_LBIP, _rLBIP, (a0,a1,a2)),
                Request::del(Fact::LBIP(a0,a1,a2)) => remove_resp!(_LBIP, _rLBIP, (a0,a1,a2)),
                Request::chk(Relation::LBIP) => check!(_rLBIP),
                Request::enm(Relation::LBIP) => enm!(_rLBIP),
                Request::add(Fact::ACL(a0,a1,a2,a3,a4)) => insert_resp!(_ACL, _rACL, (a0,a1,a2,a3,a4)),
                Request::del(Fact::ACL(a0,a1,a2,a3,a4)) => remove_resp!(_ACL, _rACL, (a0,a1,a2,a3,a4)),
                Request::chk(Relation::ACL) => check!(_rACL),
                Request::enm(Relation::ACL) => enm!(_rACL),
                Request::add(Fact::LBRouter(a0,a1)) => insert_resp!(_LBRouter, _rLBRouter, (a0,a1)),
                Request::del(Fact::LBRouter(a0,a1)) => remove_resp!(_LBRouter, _rLBRouter, (a0,a1)),
                Request::chk(Relation::LBRouter) => check!(_rLBRouter),
                Request::enm(Relation::LBRouter) => enm!(_rLBRouter),
                Request::add(Fact::LRouterPortNetwork(a0,a1)) => insert_resp!(_LRouterPortNetwork, _rLRouterPortNetwork, (a0,a1)),
                Request::del(Fact::LRouterPortNetwork(a0,a1)) => remove_resp!(_LRouterPortNetwork, _rLRouterPortNetwork, (a0,a1)),
                Request::chk(Relation::LRouterPortNetwork) => check!(_rLRouterPortNetwork),
                Request::enm(Relation::LRouterPortNetwork) => enm!(_rLRouterPortNetwork),
                Request::add(Fact::LogicalRouterStaticRoute(a0,a1,a2,a3)) => insert_resp!(_LogicalRouterStaticRoute, _rLogicalRouterStaticRoute, (a0,a1,a2,a3)),
                Request::del(Fact::LogicalRouterStaticRoute(a0,a1,a2,a3)) => remove_resp!(_LogicalRouterStaticRoute, _rLogicalRouterStaticRoute, (a0,a1,a2,a3)),
                Request::chk(Relation::LogicalRouterStaticRoute) => check!(_rLogicalRouterStaticRoute),
                Request::enm(Relation::LogicalRouterStaticRoute) => enm!(_rLogicalRouterStaticRoute),
                Request::add(Fact::NAT(a0,a1,a2,a3,a4,a5)) => insert_resp!(_NAT, _rNAT, (a0,a1,a2,a3,a4,a5)),
                Request::del(Fact::NAT(a0,a1,a2,a3,a4,a5)) => remove_resp!(_NAT, _rNAT, (a0,a1,a2,a3,a4,a5)),
                Request::chk(Relation::NAT) => check!(_rNAT),
                Request::enm(Relation::NAT) => enm!(_rNAT),
                Request::add(Fact::LearnedAddress(a0,a1,a2)) => insert_resp!(_LearnedAddress, _rLearnedAddress, (a0,a1,a2)),
                Request::del(Fact::LearnedAddress(a0,a1,a2)) => remove_resp!(_LearnedAddress, _rLearnedAddress, (a0,a1,a2)),
                Request::chk(Relation::LearnedAddress) => check!(_rLearnedAddress),
                Request::enm(Relation::LearnedAddress) => enm!(_rLearnedAddress),
                Request::add(Fact::TunnelPort(a0,a1,a2,a3)) => insert_resp!(_TunnelPort, _rTunnelPort, (a0,a1,a2,a3)),
                Request::del(Fact::TunnelPort(a0,a1,a2,a3)) => remove_resp!(_TunnelPort, _rTunnelPort, (a0,a1,a2,a3)),
                Request::chk(Relation::TunnelPort) => check!(_rTunnelPort),
                Request::enm(Relation::TunnelPort) => enm!(_rTunnelPort),
                Request::add(Fact::TrunkPort(a0)) => insert_resp!(_TrunkPort, _rTrunkPort, a0),
                Request::del(Fact::TrunkPort(a0)) => remove_resp!(_TrunkPort, _rTrunkPort, a0),
                Request::chk(Relation::TrunkPort) => check!(_rTrunkPort),
                Request::enm(Relation::TrunkPort) => enm!(_rTrunkPort),
                Request::add(Fact::PortSecurityEnabled(a0)) => insert_resp!(_PortSecurityEnabled, _rPortSecurityEnabled, a0),
                Request::del(Fact::PortSecurityEnabled(a0)) => remove_resp!(_PortSecurityEnabled, _rPortSecurityEnabled, a0),
                Request::chk(Relation::PortSecurityEnabled) => check!(_rPortSecurityEnabled),
                Request::enm(Relation::PortSecurityEnabled) => enm!(_rPortSecurityEnabled),
                Request::add(Fact::PortIPSecurityEnabled(a0)) => insert_resp!(_PortIPSecurityEnabled, _rPortIPSecurityEnabled, a0),
                Request::del(Fact::PortIPSecurityEnabled(a0)) => remove_resp!(_PortIPSecurityEnabled, _rPortIPSecurityEnabled, a0),
                Request::chk(Relation::PortIPSecurityEnabled) => check!(_rPortIPSecurityEnabled),
                Request::enm(Relation::PortIPSecurityEnabled) => enm!(_rPortIPSecurityEnabled),
                Request::add(Fact::PortSecurityType(a0,a1)) => insert_resp!(_PortSecurityType, _rPortSecurityType, (a0,a1)),
                Request::del(Fact::PortSecurityType(a0,a1)) => remove_resp!(_PortSecurityType, _rPortSecurityType, (a0,a1)),
                Request::chk(Relation::PortSecurityType) => check!(_rPortSecurityType),
                Request::enm(Relation::PortSecurityType) => enm!(_rPortSecurityType),
                Request::add(Fact::PortSecurityIP4Match(a0,a1,a2)) => insert_resp!(_PortSecurityIP4Match, _rPortSecurityIP4Match, (a0,a1,a2)),
                Request::del(Fact::PortSecurityIP4Match(a0,a1,a2)) => remove_resp!(_PortSecurityIP4Match, _rPortSecurityIP4Match, (a0,a1,a2)),
                Request::chk(Relation::PortSecurityIP4Match) => check!(_rPortSecurityIP4Match),
                Request::enm(Relation::PortSecurityIP4Match) => enm!(_rPortSecurityIP4Match),
                Request::add(Fact::PortSecurityIP6Match(a0,a1,a2)) => insert_resp!(_PortSecurityIP6Match, _rPortSecurityIP6Match, (a0,a1,a2)),
                Request::del(Fact::PortSecurityIP6Match(a0,a1,a2)) => remove_resp!(_PortSecurityIP6Match, _rPortSecurityIP6Match, (a0,a1,a2)),
                Request::chk(Relation::PortSecurityIP6Match) => check!(_rPortSecurityIP6Match),
                Request::enm(Relation::PortSecurityIP6Match) => enm!(_rPortSecurityIP6Match),
                Request::add(Fact::LPortStatefulACL(a0)) => insert_resp!(_LPortStatefulACL, _rLPortStatefulACL, a0),
                Request::del(Fact::LPortStatefulACL(a0)) => remove_resp!(_LPortStatefulACL, _rLPortStatefulACL, a0),
                Request::chk(Relation::LPortStatefulACL) => check!(_rLPortStatefulACL),
                Request::enm(Relation::LPortStatefulACL) => enm!(_rLPortStatefulACL),
                Request::add(Fact::LPortLBVIP(a0,a1)) => insert_resp!(_LPortLBVIP, _rLPortLBVIP, (a0,a1)),
                Request::del(Fact::LPortLBVIP(a0,a1)) => remove_resp!(_LPortLBVIP, _rLPortLBVIP, (a0,a1)),
                Request::chk(Relation::LPortLBVIP) => check!(_rLPortLBVIP),
                Request::enm(Relation::LPortLBVIP) => enm!(_rLPortLBVIP),
                Request::add(Fact::LPortLBVIPIP(a0,a1,a2,a3)) => insert_resp!(_LPortLBVIPIP, _rLPortLBVIPIP, (a0,a1,a2,a3)),
                Request::del(Fact::LPortLBVIPIP(a0,a1,a2,a3)) => remove_resp!(_LPortLBVIPIP, _rLPortLBVIPIP, (a0,a1,a2,a3)),
                Request::chk(Relation::LPortLBVIPIP) => check!(_rLPortLBVIPIP),
                Request::enm(Relation::LPortLBVIPIP) => enm!(_rLPortLBVIPIP),
                Request::add(Fact::LPortLB(a0)) => insert_resp!(_LPortLB, _rLPortLB, a0),
                Request::del(Fact::LPortLB(a0)) => remove_resp!(_LPortLB, _rLPortLB, a0),
                Request::chk(Relation::LPortLB) => check!(_rLPortLB),
                Request::enm(Relation::LPortLB) => enm!(_rLPortLB),
                Request::add(Fact::LPortMACIP(a0,a1,a2,a3)) => insert_resp!(_LPortMACIP, _rLPortMACIP, (a0,a1,a2,a3)),
                Request::del(Fact::LPortMACIP(a0,a1,a2,a3)) => remove_resp!(_LPortMACIP, _rLPortMACIP, (a0,a1,a2,a3)),
                Request::chk(Relation::LPortMACIP) => check!(_rLPortMACIP),
                Request::enm(Relation::LPortMACIP) => enm!(_rLPortMACIP),
                Request::add(Fact::LPortDHCP4AddrOpts(a0,a1,a2,a3)) => insert_resp!(_LPortDHCP4AddrOpts, _rLPortDHCP4AddrOpts, (a0,a1,a2,a3)),
                Request::del(Fact::LPortDHCP4AddrOpts(a0,a1,a2,a3)) => remove_resp!(_LPortDHCP4AddrOpts, _rLPortDHCP4AddrOpts, (a0,a1,a2,a3)),
                Request::chk(Relation::LPortDHCP4AddrOpts) => check!(_rLPortDHCP4AddrOpts),
                Request::enm(Relation::LPortDHCP4AddrOpts) => enm!(_rLPortDHCP4AddrOpts),
                Request::add(Fact::LPortDHCP6AddrOpts(a0,a1,a2,a3,a4)) => insert_resp!(_LPortDHCP6AddrOpts, _rLPortDHCP6AddrOpts, (a0,a1,a2,a3,a4)),
                Request::del(Fact::LPortDHCP6AddrOpts(a0,a1,a2,a3,a4)) => remove_resp!(_LPortDHCP6AddrOpts, _rLPortDHCP6AddrOpts, (a0,a1,a2,a3,a4)),
                Request::chk(Relation::LPortDHCP6AddrOpts) => check!(_rLPortDHCP6AddrOpts),
                Request::enm(Relation::LPortDHCP6AddrOpts) => enm!(_rLPortDHCP6AddrOpts),
                Request::add(Fact::LPortAtChassis(a0,a1,a2,a3)) => insert_resp!(_LPortAtChassis, _rLPortAtChassis, (a0,a1,a2,a3)),
                Request::del(Fact::LPortAtChassis(a0,a1,a2,a3)) => remove_resp!(_LPortAtChassis, _rLPortAtChassis, (a0,a1,a2,a3)),
                Request::chk(Relation::LPortAtChassis) => check!(_rLPortAtChassis),
                Request::enm(Relation::LPortAtChassis) => enm!(_rLPortAtChassis),
                Request::add(Fact::LPortMACChassis(a0,a1,a2,a3,a4)) => insert_resp!(_LPortMACChassis, _rLPortMACChassis, (a0,a1,a2,a3,a4)),
                Request::del(Fact::LPortMACChassis(a0,a1,a2,a3,a4)) => remove_resp!(_LPortMACChassis, _rLPortMACChassis, (a0,a1,a2,a3,a4)),
                Request::chk(Relation::LPortMACChassis) => check!(_rLPortMACChassis),
                Request::enm(Relation::LPortMACChassis) => enm!(_rLPortMACChassis),
                Request::add(Fact::LPortUnknownMACChassis(a0,a1,a2,a3)) => insert_resp!(_LPortUnknownMACChassis, _rLPortUnknownMACChassis, (a0,a1,a2,a3)),
                Request::del(Fact::LPortUnknownMACChassis(a0,a1,a2,a3)) => remove_resp!(_LPortUnknownMACChassis, _rLPortUnknownMACChassis, (a0,a1,a2,a3)),
                Request::chk(Relation::LPortUnknownMACChassis) => check!(_rLPortUnknownMACChassis),
                Request::enm(Relation::LPortUnknownMACChassis) => enm!(_rLPortUnknownMACChassis),
                Request::add(Fact::LSwitchAtChassis(a0,a1,a2)) => insert_resp!(_LSwitchAtChassis, _rLSwitchAtChassis, (a0,a1,a2)),
                Request::del(Fact::LSwitchAtChassis(a0,a1,a2)) => remove_resp!(_LSwitchAtChassis, _rLSwitchAtChassis, (a0,a1,a2)),
                Request::chk(Relation::LSwitchAtChassis) => check!(_rLSwitchAtChassis),
                Request::enm(Relation::LSwitchAtChassis) => enm!(_rLSwitchAtChassis),
                Request::add(Fact::MACChassis(a0,a1,a2)) => insert_resp!(_MACChassis, _rMACChassis, (a0,a1,a2)),
                Request::del(Fact::MACChassis(a0,a1,a2)) => remove_resp!(_MACChassis, _rMACChassis, (a0,a1,a2)),
                Request::chk(Relation::MACChassis) => check!(_rMACChassis),
                Request::enm(Relation::MACChassis) => enm!(_rMACChassis),
                Request::add(Fact::UnknownMACChassis(a0,a1,a2)) => insert_resp!(_UnknownMACChassis, _rUnknownMACChassis, (a0,a1,a2)),
                Request::del(Fact::UnknownMACChassis(a0,a1,a2)) => remove_resp!(_UnknownMACChassis, _rUnknownMACChassis, (a0,a1,a2)),
                Request::chk(Relation::UnknownMACChassis) => check!(_rUnknownMACChassis),
                Request::enm(Relation::UnknownMACChassis) => enm!(_rUnknownMACChassis),
                Request::add(Fact::TunnelFromTo(a0,a1,a2)) => insert_resp!(_TunnelFromTo, _rTunnelFromTo, (a0,a1,a2)),
                Request::del(Fact::TunnelFromTo(a0,a1,a2)) => remove_resp!(_TunnelFromTo, _rTunnelFromTo, (a0,a1,a2)),
                Request::chk(Relation::TunnelFromTo) => check!(_rTunnelFromTo),
                Request::enm(Relation::TunnelFromTo) => enm!(_rTunnelFromTo),
                Request::add(Fact::LRouterNetwork(a0,a1)) => insert_resp!(_LRouterNetwork, _rLRouterNetwork, (a0,a1)),
                Request::del(Fact::LRouterNetwork(a0,a1)) => remove_resp!(_LRouterNetwork, _rLRouterNetwork, (a0,a1)),
                Request::chk(Relation::LRouterNetwork) => check!(_rLRouterNetwork),
                Request::enm(Relation::LRouterNetwork) => enm!(_rLRouterNetwork),
                Request::add(Fact::LRouterLBVIP(a0,a1)) => insert_resp!(_LRouterLBVIP, _rLRouterLBVIP, (a0,a1)),
                Request::del(Fact::LRouterLBVIP(a0,a1)) => remove_resp!(_LRouterLBVIP, _rLRouterLBVIP, (a0,a1)),
                Request::chk(Relation::LRouterLBVIP) => check!(_rLRouterLBVIP),
                Request::enm(Relation::LRouterLBVIP) => enm!(_rLRouterLBVIP),
                Request::add(Fact::NATChassis(a0,a1,a2,a3,a4,a5,a6)) => insert_resp!(_NATChassis, _rNATChassis, (a0,a1,a2,a3,a4,a5,a6)),
                Request::del(Fact::NATChassis(a0,a1,a2,a3,a4,a5,a6)) => remove_resp!(_NATChassis, _rNATChassis, (a0,a1,a2,a3,a4,a5,a6)),
                Request::chk(Relation::NATChassis) => check!(_rNATChassis),
                Request::enm(Relation::NATChassis) => enm!(_rNATChassis),
                Request::add(Fact::Route(a0,a1,a2,a3,a4,a5)) => insert_resp!(_Route, _rRoute, (a0,a1,a2,a3,a4,a5)),
                Request::del(Fact::Route(a0,a1,a2,a3,a4,a5)) => remove_resp!(_Route, _rRoute, (a0,a1,a2,a3,a4,a5)),
                Request::chk(Relation::Route) => check!(_rRoute),
                Request::enm(Relation::Route) => enm!(_rRoute),
                Request::add(Fact::_realized_VSwitchPort(a0,a1,a2,a3)) => insert_resp!(__realized_VSwitchPort, _r_realized_VSwitchPort, (a0,a1,a2,a3)),
                Request::del(Fact::_realized_VSwitchPort(a0,a1,a2,a3)) => remove_resp!(__realized_VSwitchPort, _r_realized_VSwitchPort, (a0,a1,a2,a3)),
                Request::chk(Relation::_realized_VSwitchPort) => check!(_r_realized_VSwitchPort),
                Request::enm(Relation::_realized_VSwitchPort) => enm!(_r_realized_VSwitchPort),
                Request::add(Fact::_delta_VSwitchPort(a0,a1,a2,a3,a4)) => insert_resp!(__delta_VSwitchPort, _r_delta_VSwitchPort, (a0,a1,a2,a3,a4)),
                Request::del(Fact::_delta_VSwitchPort(a0,a1,a2,a3,a4)) => remove_resp!(__delta_VSwitchPort, _r_delta_VSwitchPort, (a0,a1,a2,a3,a4)),
                Request::chk(Relation::_delta_VSwitchPort) => check!(_r_delta_VSwitchPort),
                Request::enm(Relation::_delta_VSwitchPort) => enm!(_r_delta_VSwitchPort),
                Request::add(Fact::_realized_LPortBinding(a0,a1)) => insert_resp!(__realized_LPortBinding, _r_realized_LPortBinding, (a0,a1)),
                Request::del(Fact::_realized_LPortBinding(a0,a1)) => remove_resp!(__realized_LPortBinding, _r_realized_LPortBinding, (a0,a1)),
                Request::chk(Relation::_realized_LPortBinding) => check!(_r_realized_LPortBinding),
                Request::enm(Relation::_realized_LPortBinding) => enm!(_r_realized_LPortBinding),
                Request::add(Fact::_delta_LPortBinding(a0,a1,a2)) => insert_resp!(__delta_LPortBinding, _r_delta_LPortBinding, (a0,a1,a2)),
                Request::del(Fact::_delta_LPortBinding(a0,a1,a2)) => remove_resp!(__delta_LPortBinding, _r_delta_LPortBinding, (a0,a1,a2)),
                Request::chk(Relation::_delta_LPortBinding) => check!(_r_delta_LPortBinding),
                Request::enm(Relation::_delta_LPortBinding) => enm!(_r_delta_LPortBinding),
                Request::add(Fact::_realized_LogicalSwitchPort(a0,a1,a2,a3,a4,a5,a6,a7,a8)) => insert_resp!(__realized_LogicalSwitchPort, _r_realized_LogicalSwitchPort, (a0,a1,a2,a3,a4,a5,a6,a7,a8)),
                Request::del(Fact::_realized_LogicalSwitchPort(a0,a1,a2,a3,a4,a5,a6,a7,a8)) => remove_resp!(__realized_LogicalSwitchPort, _r_realized_LogicalSwitchPort, (a0,a1,a2,a3,a4,a5,a6,a7,a8)),
                Request::chk(Relation::_realized_LogicalSwitchPort) => check!(_r_realized_LogicalSwitchPort),
                Request::enm(Relation::_realized_LogicalSwitchPort) => enm!(_r_realized_LogicalSwitchPort),
                Request::add(Fact::_delta_LogicalSwitchPort(a0,a1,a2,a3,a4,a5,a6,a7,a8,a9)) => insert_resp!(__delta_LogicalSwitchPort, _r_delta_LogicalSwitchPort, (a0,a1,a2,a3,a4,a5,a6,a7,a8,a9)),
                Request::del(Fact::_delta_LogicalSwitchPort(a0,a1,a2,a3,a4,a5,a6,a7,a8,a9)) => remove_resp!(__delta_LogicalSwitchPort, _r_delta_LogicalSwitchPort, (a0,a1,a2,a3,a4,a5,a6,a7,a8,a9)),
                Request::chk(Relation::_delta_LogicalSwitchPort) => check!(_r_delta_LogicalSwitchPort),
                Request::enm(Relation::_delta_LogicalSwitchPort) => enm!(_r_delta_LogicalSwitchPort),
                Request::add(Fact::_realized_PortSecurityType(a0,a1)) => insert_resp!(__realized_PortSecurityType, _r_realized_PortSecurityType, (a0,a1)),
                Request::del(Fact::_realized_PortSecurityType(a0,a1)) => remove_resp!(__realized_PortSecurityType, _r_realized_PortSecurityType, (a0,a1)),
                Request::chk(Relation::_realized_PortSecurityType) => check!(_r_realized_PortSecurityType),
                Request::enm(Relation::_realized_PortSecurityType) => enm!(_r_realized_PortSecurityType),
                Request::add(Fact::_delta_PortSecurityType(a0,a1,a2)) => insert_resp!(__delta_PortSecurityType, _r_delta_PortSecurityType, (a0,a1,a2)),
                Request::del(Fact::_delta_PortSecurityType(a0,a1,a2)) => remove_resp!(__delta_PortSecurityType, _r_delta_PortSecurityType, (a0,a1,a2)),
                Request::chk(Relation::_delta_PortSecurityType) => check!(_r_delta_PortSecurityType),
                Request::enm(Relation::_delta_PortSecurityType) => enm!(_r_delta_PortSecurityType),
                Request::add(Fact::_realized_PortSecurityMAC(a0,a1)) => insert_resp!(__realized_PortSecurityMAC, _r_realized_PortSecurityMAC, (a0,a1)),
                Request::del(Fact::_realized_PortSecurityMAC(a0,a1)) => remove_resp!(__realized_PortSecurityMAC, _r_realized_PortSecurityMAC, (a0,a1)),
                Request::chk(Relation::_realized_PortSecurityMAC) => check!(_r_realized_PortSecurityMAC),
                Request::enm(Relation::_realized_PortSecurityMAC) => enm!(_r_realized_PortSecurityMAC),
                Request::add(Fact::_delta_PortSecurityMAC(a0,a1,a2)) => insert_resp!(__delta_PortSecurityMAC, _r_delta_PortSecurityMAC, (a0,a1,a2)),
                Request::del(Fact::_delta_PortSecurityMAC(a0,a1,a2)) => remove_resp!(__delta_PortSecurityMAC, _r_delta_PortSecurityMAC, (a0,a1,a2)),
                Request::chk(Relation::_delta_PortSecurityMAC) => check!(_r_delta_PortSecurityMAC),
                Request::enm(Relation::_delta_PortSecurityMAC) => enm!(_r_delta_PortSecurityMAC),
                Request::add(Fact::_realized_LPortStatefulACL(a0)) => insert_resp!(__realized_LPortStatefulACL, _r_realized_LPortStatefulACL, a0),
                Request::del(Fact::_realized_LPortStatefulACL(a0)) => remove_resp!(__realized_LPortStatefulACL, _r_realized_LPortStatefulACL, a0),
                Request::chk(Relation::_realized_LPortStatefulACL) => check!(_r_realized_LPortStatefulACL),
                Request::enm(Relation::_realized_LPortStatefulACL) => enm!(_r_realized_LPortStatefulACL),
                Request::add(Fact::_delta_LPortStatefulACL(a0,a1)) => insert_resp!(__delta_LPortStatefulACL, _r_delta_LPortStatefulACL, (a0,a1)),
                Request::del(Fact::_delta_LPortStatefulACL(a0,a1)) => remove_resp!(__delta_LPortStatefulACL, _r_delta_LPortStatefulACL, (a0,a1)),
                Request::chk(Relation::_delta_LPortStatefulACL) => check!(_r_delta_LPortStatefulACL),
                Request::enm(Relation::_delta_LPortStatefulACL) => enm!(_r_delta_LPortStatefulACL),
                Request::add(Fact::_realized_LPortLBVIP(a0,a1)) => insert_resp!(__realized_LPortLBVIP, _r_realized_LPortLBVIP, (a0,a1)),
                Request::del(Fact::_realized_LPortLBVIP(a0,a1)) => remove_resp!(__realized_LPortLBVIP, _r_realized_LPortLBVIP, (a0,a1)),
                Request::chk(Relation::_realized_LPortLBVIP) => check!(_r_realized_LPortLBVIP),
                Request::enm(Relation::_realized_LPortLBVIP) => enm!(_r_realized_LPortLBVIP),
                Request::add(Fact::_delta_LPortLBVIP(a0,a1,a2)) => insert_resp!(__delta_LPortLBVIP, _r_delta_LPortLBVIP, (a0,a1,a2)),
                Request::del(Fact::_delta_LPortLBVIP(a0,a1,a2)) => remove_resp!(__delta_LPortLBVIP, _r_delta_LPortLBVIP, (a0,a1,a2)),
                Request::chk(Relation::_delta_LPortLBVIP) => check!(_r_delta_LPortLBVIP),
                Request::enm(Relation::_delta_LPortLBVIP) => enm!(_r_delta_LPortLBVIP),
                Request::add(Fact::_realized_ACL(a0,a1,a2,a3,a4)) => insert_resp!(__realized_ACL, _r_realized_ACL, (a0,a1,a2,a3,a4)),
                Request::del(Fact::_realized_ACL(a0,a1,a2,a3,a4)) => remove_resp!(__realized_ACL, _r_realized_ACL, (a0,a1,a2,a3,a4)),
                Request::chk(Relation::_realized_ACL) => check!(_r_realized_ACL),
                Request::enm(Relation::_realized_ACL) => enm!(_r_realized_ACL),
                Request::add(Fact::_delta_ACL(a0,a1,a2,a3,a4,a5)) => insert_resp!(__delta_ACL, _r_delta_ACL, (a0,a1,a2,a3,a4,a5)),
                Request::del(Fact::_delta_ACL(a0,a1,a2,a3,a4,a5)) => remove_resp!(__delta_ACL, _r_delta_ACL, (a0,a1,a2,a3,a4,a5)),
                Request::chk(Relation::_delta_ACL) => check!(_r_delta_ACL),
                Request::enm(Relation::_delta_ACL) => enm!(_r_delta_ACL),
                Request::add(Fact::_realized_LPortLBVIPIP(a0,a1,a2,a3)) => insert_resp!(__realized_LPortLBVIPIP, _r_realized_LPortLBVIPIP, (a0,a1,a2,a3)),
                Request::del(Fact::_realized_LPortLBVIPIP(a0,a1,a2,a3)) => remove_resp!(__realized_LPortLBVIPIP, _r_realized_LPortLBVIPIP, (a0,a1,a2,a3)),
                Request::chk(Relation::_realized_LPortLBVIPIP) => check!(_r_realized_LPortLBVIPIP),
                Request::enm(Relation::_realized_LPortLBVIPIP) => enm!(_r_realized_LPortLBVIPIP),
                Request::add(Fact::_delta_LPortLBVIPIP(a0,a1,a2,a3,a4)) => insert_resp!(__delta_LPortLBVIPIP, _r_delta_LPortLBVIPIP, (a0,a1,a2,a3,a4)),
                Request::del(Fact::_delta_LPortLBVIPIP(a0,a1,a2,a3,a4)) => remove_resp!(__delta_LPortLBVIPIP, _r_delta_LPortLBVIPIP, (a0,a1,a2,a3,a4)),
                Request::chk(Relation::_delta_LPortLBVIPIP) => check!(_r_delta_LPortLBVIPIP),
                Request::enm(Relation::_delta_LPortLBVIPIP) => enm!(_r_delta_LPortLBVIPIP),
                Request::add(Fact::_realized_LPortMACIP(a0,a1,a2,a3)) => insert_resp!(__realized_LPortMACIP, _r_realized_LPortMACIP, (a0,a1,a2,a3)),
                Request::del(Fact::_realized_LPortMACIP(a0,a1,a2,a3)) => remove_resp!(__realized_LPortMACIP, _r_realized_LPortMACIP, (a0,a1,a2,a3)),
                Request::chk(Relation::_realized_LPortMACIP) => check!(_r_realized_LPortMACIP),
                Request::enm(Relation::_realized_LPortMACIP) => enm!(_r_realized_LPortMACIP),
                Request::add(Fact::_delta_LPortMACIP(a0,a1,a2,a3,a4)) => insert_resp!(__delta_LPortMACIP, _r_delta_LPortMACIP, (a0,a1,a2,a3,a4)),
                Request::del(Fact::_delta_LPortMACIP(a0,a1,a2,a3,a4)) => remove_resp!(__delta_LPortMACIP, _r_delta_LPortMACIP, (a0,a1,a2,a3,a4)),
                Request::chk(Relation::_delta_LPortMACIP) => check!(_r_delta_LPortMACIP),
                Request::enm(Relation::_delta_LPortMACIP) => enm!(_r_delta_LPortMACIP),
                Request::add(Fact::_realized_LPortDHCP4AddrOpts(a0,a1,a2,a3)) => insert_resp!(__realized_LPortDHCP4AddrOpts, _r_realized_LPortDHCP4AddrOpts, (a0,a1,a2,a3)),
                Request::del(Fact::_realized_LPortDHCP4AddrOpts(a0,a1,a2,a3)) => remove_resp!(__realized_LPortDHCP4AddrOpts, _r_realized_LPortDHCP4AddrOpts, (a0,a1,a2,a3)),
                Request::chk(Relation::_realized_LPortDHCP4AddrOpts) => check!(_r_realized_LPortDHCP4AddrOpts),
                Request::enm(Relation::_realized_LPortDHCP4AddrOpts) => enm!(_r_realized_LPortDHCP4AddrOpts),
                Request::add(Fact::_delta_LPortDHCP4AddrOpts(a0,a1,a2,a3,a4)) => insert_resp!(__delta_LPortDHCP4AddrOpts, _r_delta_LPortDHCP4AddrOpts, (a0,a1,a2,a3,a4)),
                Request::del(Fact::_delta_LPortDHCP4AddrOpts(a0,a1,a2,a3,a4)) => remove_resp!(__delta_LPortDHCP4AddrOpts, _r_delta_LPortDHCP4AddrOpts, (a0,a1,a2,a3,a4)),
                Request::chk(Relation::_delta_LPortDHCP4AddrOpts) => check!(_r_delta_LPortDHCP4AddrOpts),
                Request::enm(Relation::_delta_LPortDHCP4AddrOpts) => enm!(_r_delta_LPortDHCP4AddrOpts),
                Request::add(Fact::_realized_LPortDHCP6AddrOpts(a0,a1,a2,a3,a4)) => insert_resp!(__realized_LPortDHCP6AddrOpts, _r_realized_LPortDHCP6AddrOpts, (a0,a1,a2,a3,a4)),
                Request::del(Fact::_realized_LPortDHCP6AddrOpts(a0,a1,a2,a3,a4)) => remove_resp!(__realized_LPortDHCP6AddrOpts, _r_realized_LPortDHCP6AddrOpts, (a0,a1,a2,a3,a4)),
                Request::chk(Relation::_realized_LPortDHCP6AddrOpts) => check!(_r_realized_LPortDHCP6AddrOpts),
                Request::enm(Relation::_realized_LPortDHCP6AddrOpts) => enm!(_r_realized_LPortDHCP6AddrOpts),
                Request::add(Fact::_delta_LPortDHCP6AddrOpts(a0,a1,a2,a3,a4,a5)) => insert_resp!(__delta_LPortDHCP6AddrOpts, _r_delta_LPortDHCP6AddrOpts, (a0,a1,a2,a3,a4,a5)),
                Request::del(Fact::_delta_LPortDHCP6AddrOpts(a0,a1,a2,a3,a4,a5)) => remove_resp!(__delta_LPortDHCP6AddrOpts, _r_delta_LPortDHCP6AddrOpts, (a0,a1,a2,a3,a4,a5)),
                Request::chk(Relation::_delta_LPortDHCP6AddrOpts) => check!(_r_delta_LPortDHCP6AddrOpts),
                Request::enm(Relation::_delta_LPortDHCP6AddrOpts) => enm!(_r_delta_LPortDHCP6AddrOpts),
                Request::add(Fact::_realized_LSwitchAtChassis(a0,a1,a2)) => insert_resp!(__realized_LSwitchAtChassis, _r_realized_LSwitchAtChassis, (a0,a1,a2)),
                Request::del(Fact::_realized_LSwitchAtChassis(a0,a1,a2)) => remove_resp!(__realized_LSwitchAtChassis, _r_realized_LSwitchAtChassis, (a0,a1,a2)),
                Request::chk(Relation::_realized_LSwitchAtChassis) => check!(_r_realized_LSwitchAtChassis),
                Request::enm(Relation::_realized_LSwitchAtChassis) => enm!(_r_realized_LSwitchAtChassis),
                Request::add(Fact::_delta_LSwitchAtChassis(a0,a1,a2,a3)) => insert_resp!(__delta_LSwitchAtChassis, _r_delta_LSwitchAtChassis, (a0,a1,a2,a3)),
                Request::del(Fact::_delta_LSwitchAtChassis(a0,a1,a2,a3)) => remove_resp!(__delta_LSwitchAtChassis, _r_delta_LSwitchAtChassis, (a0,a1,a2,a3)),
                Request::chk(Relation::_delta_LSwitchAtChassis) => check!(_r_delta_LSwitchAtChassis),
                Request::enm(Relation::_delta_LSwitchAtChassis) => enm!(_r_delta_LSwitchAtChassis),
                Request::add(Fact::_realized_MACChassis(a0,a1,a2)) => insert_resp!(__realized_MACChassis, _r_realized_MACChassis, (a0,a1,a2)),
                Request::del(Fact::_realized_MACChassis(a0,a1,a2)) => remove_resp!(__realized_MACChassis, _r_realized_MACChassis, (a0,a1,a2)),
                Request::chk(Relation::_realized_MACChassis) => check!(_r_realized_MACChassis),
                Request::enm(Relation::_realized_MACChassis) => enm!(_r_realized_MACChassis),
                Request::add(Fact::_delta_MACChassis(a0,a1,a2,a3)) => insert_resp!(__delta_MACChassis, _r_delta_MACChassis, (a0,a1,a2,a3)),
                Request::del(Fact::_delta_MACChassis(a0,a1,a2,a3)) => remove_resp!(__delta_MACChassis, _r_delta_MACChassis, (a0,a1,a2,a3)),
                Request::chk(Relation::_delta_MACChassis) => check!(_r_delta_MACChassis),
                Request::enm(Relation::_delta_MACChassis) => enm!(_r_delta_MACChassis),
                Request::add(Fact::_realized_UnknownMACChassis(a0,a1,a2)) => insert_resp!(__realized_UnknownMACChassis, _r_realized_UnknownMACChassis, (a0,a1,a2)),
                Request::del(Fact::_realized_UnknownMACChassis(a0,a1,a2)) => remove_resp!(__realized_UnknownMACChassis, _r_realized_UnknownMACChassis, (a0,a1,a2)),
                Request::chk(Relation::_realized_UnknownMACChassis) => check!(_r_realized_UnknownMACChassis),
                Request::enm(Relation::_realized_UnknownMACChassis) => enm!(_r_realized_UnknownMACChassis),
                Request::add(Fact::_delta_UnknownMACChassis(a0,a1,a2,a3)) => insert_resp!(__delta_UnknownMACChassis, _r_delta_UnknownMACChassis, (a0,a1,a2,a3)),
                Request::del(Fact::_delta_UnknownMACChassis(a0,a1,a2,a3)) => remove_resp!(__delta_UnknownMACChassis, _r_delta_UnknownMACChassis, (a0,a1,a2,a3)),
                Request::chk(Relation::_delta_UnknownMACChassis) => check!(_r_delta_UnknownMACChassis),
                Request::enm(Relation::_delta_UnknownMACChassis) => enm!(_r_delta_UnknownMACChassis),
                Request::add(Fact::_realized_PortSecurityIP4Match(a0,a1,a2)) => insert_resp!(__realized_PortSecurityIP4Match, _r_realized_PortSecurityIP4Match, (a0,a1,a2)),
                Request::del(Fact::_realized_PortSecurityIP4Match(a0,a1,a2)) => remove_resp!(__realized_PortSecurityIP4Match, _r_realized_PortSecurityIP4Match, (a0,a1,a2)),
                Request::chk(Relation::_realized_PortSecurityIP4Match) => check!(_r_realized_PortSecurityIP4Match),
                Request::enm(Relation::_realized_PortSecurityIP4Match) => enm!(_r_realized_PortSecurityIP4Match),
                Request::add(Fact::_delta_PortSecurityIP4Match(a0,a1,a2,a3)) => insert_resp!(__delta_PortSecurityIP4Match, _r_delta_PortSecurityIP4Match, (a0,a1,a2,a3)),
                Request::del(Fact::_delta_PortSecurityIP4Match(a0,a1,a2,a3)) => remove_resp!(__delta_PortSecurityIP4Match, _r_delta_PortSecurityIP4Match, (a0,a1,a2,a3)),
                Request::chk(Relation::_delta_PortSecurityIP4Match) => check!(_r_delta_PortSecurityIP4Match),
                Request::enm(Relation::_delta_PortSecurityIP4Match) => enm!(_r_delta_PortSecurityIP4Match),
                Request::add(Fact::_realized_PortSecurityIP(a0,a1,a2)) => insert_resp!(__realized_PortSecurityIP, _r_realized_PortSecurityIP, (a0,a1,a2)),
                Request::del(Fact::_realized_PortSecurityIP(a0,a1,a2)) => remove_resp!(__realized_PortSecurityIP, _r_realized_PortSecurityIP, (a0,a1,a2)),
                Request::chk(Relation::_realized_PortSecurityIP) => check!(_r_realized_PortSecurityIP),
                Request::enm(Relation::_realized_PortSecurityIP) => enm!(_r_realized_PortSecurityIP),
                Request::add(Fact::_delta_PortSecurityIP(a0,a1,a2,a3)) => insert_resp!(__delta_PortSecurityIP, _r_delta_PortSecurityIP, (a0,a1,a2,a3)),
                Request::del(Fact::_delta_PortSecurityIP(a0,a1,a2,a3)) => remove_resp!(__delta_PortSecurityIP, _r_delta_PortSecurityIP, (a0,a1,a2,a3)),
                Request::chk(Relation::_delta_PortSecurityIP) => check!(_r_delta_PortSecurityIP),
                Request::enm(Relation::_delta_PortSecurityIP) => enm!(_r_delta_PortSecurityIP),
                Request::add(Fact::_realized_PortSecurityIP6Match(a0,a1,a2)) => insert_resp!(__realized_PortSecurityIP6Match, _r_realized_PortSecurityIP6Match, (a0,a1,a2)),
                Request::del(Fact::_realized_PortSecurityIP6Match(a0,a1,a2)) => remove_resp!(__realized_PortSecurityIP6Match, _r_realized_PortSecurityIP6Match, (a0,a1,a2)),
                Request::chk(Relation::_realized_PortSecurityIP6Match) => check!(_r_realized_PortSecurityIP6Match),
                Request::enm(Relation::_realized_PortSecurityIP6Match) => enm!(_r_realized_PortSecurityIP6Match),
                Request::add(Fact::_delta_PortSecurityIP6Match(a0,a1,a2,a3)) => insert_resp!(__delta_PortSecurityIP6Match, _r_delta_PortSecurityIP6Match, (a0,a1,a2,a3)),
                Request::del(Fact::_delta_PortSecurityIP6Match(a0,a1,a2,a3)) => remove_resp!(__delta_PortSecurityIP6Match, _r_delta_PortSecurityIP6Match, (a0,a1,a2,a3)),
                Request::chk(Relation::_delta_PortSecurityIP6Match) => check!(_r_delta_PortSecurityIP6Match),
                Request::enm(Relation::_delta_PortSecurityIP6Match) => enm!(_r_delta_PortSecurityIP6Match),
                Request::add(Fact::_realized_LogicalRouterPort(a0,a1,a2,a3,a4,a5,a6,a7)) => insert_resp!(__realized_LogicalRouterPort, _r_realized_LogicalRouterPort, (a0,a1,a2,a3,a4,a5,a6,a7)),
                Request::del(Fact::_realized_LogicalRouterPort(a0,a1,a2,a3,a4,a5,a6,a7)) => remove_resp!(__realized_LogicalRouterPort, _r_realized_LogicalRouterPort, (a0,a1,a2,a3,a4,a5,a6,a7)),
                Request::chk(Relation::_realized_LogicalRouterPort) => check!(_r_realized_LogicalRouterPort),
                Request::enm(Relation::_realized_LogicalRouterPort) => enm!(_r_realized_LogicalRouterPort),
                Request::add(Fact::_delta_LogicalRouterPort(a0,a1,a2,a3,a4,a5,a6,a7,a8)) => insert_resp!(__delta_LogicalRouterPort, _r_delta_LogicalRouterPort, (a0,a1,a2,a3,a4,a5,a6,a7,a8)),
                Request::del(Fact::_delta_LogicalRouterPort(a0,a1,a2,a3,a4,a5,a6,a7,a8)) => remove_resp!(__delta_LogicalRouterPort, _r_delta_LogicalRouterPort, (a0,a1,a2,a3,a4,a5,a6,a7,a8)),
                Request::chk(Relation::_delta_LogicalRouterPort) => check!(_r_delta_LogicalRouterPort),
                Request::enm(Relation::_delta_LogicalRouterPort) => enm!(_r_delta_LogicalRouterPort),
                Request::add(Fact::_realized_NATChassis(a0,a1,a2,a3,a4,a5,a6)) => insert_resp!(__realized_NATChassis, _r_realized_NATChassis, (a0,a1,a2,a3,a4,a5,a6)),
                Request::del(Fact::_realized_NATChassis(a0,a1,a2,a3,a4,a5,a6)) => remove_resp!(__realized_NATChassis, _r_realized_NATChassis, (a0,a1,a2,a3,a4,a5,a6)),
                Request::chk(Relation::_realized_NATChassis) => check!(_r_realized_NATChassis),
                Request::enm(Relation::_realized_NATChassis) => enm!(_r_realized_NATChassis),
                Request::add(Fact::_delta_NATChassis(a0,a1,a2,a3,a4,a5,a6,a7)) => insert_resp!(__delta_NATChassis, _r_delta_NATChassis, (a0,a1,a2,a3,a4,a5,a6,a7)),
                Request::del(Fact::_delta_NATChassis(a0,a1,a2,a3,a4,a5,a6,a7)) => remove_resp!(__delta_NATChassis, _r_delta_NATChassis, (a0,a1,a2,a3,a4,a5,a6,a7)),
                Request::chk(Relation::_delta_NATChassis) => check!(_r_delta_NATChassis),
                Request::enm(Relation::_delta_NATChassis) => enm!(_r_delta_NATChassis),
                Request::add(Fact::_realized_LRouterNetwork(a0,a1)) => insert_resp!(__realized_LRouterNetwork, _r_realized_LRouterNetwork, (a0,a1)),
                Request::del(Fact::_realized_LRouterNetwork(a0,a1)) => remove_resp!(__realized_LRouterNetwork, _r_realized_LRouterNetwork, (a0,a1)),
                Request::chk(Relation::_realized_LRouterNetwork) => check!(_r_realized_LRouterNetwork),
                Request::enm(Relation::_realized_LRouterNetwork) => enm!(_r_realized_LRouterNetwork),
                Request::add(Fact::_delta_LRouterNetwork(a0,a1,a2)) => insert_resp!(__delta_LRouterNetwork, _r_delta_LRouterNetwork, (a0,a1,a2)),
                Request::del(Fact::_delta_LRouterNetwork(a0,a1,a2)) => remove_resp!(__delta_LRouterNetwork, _r_delta_LRouterNetwork, (a0,a1,a2)),
                Request::chk(Relation::_delta_LRouterNetwork) => check!(_r_delta_LRouterNetwork),
                Request::enm(Relation::_delta_LRouterNetwork) => enm!(_r_delta_LRouterNetwork),
                Request::add(Fact::_realized_LRouterPortNetwork(a0,a1)) => insert_resp!(__realized_LRouterPortNetwork, _r_realized_LRouterPortNetwork, (a0,a1)),
                Request::del(Fact::_realized_LRouterPortNetwork(a0,a1)) => remove_resp!(__realized_LRouterPortNetwork, _r_realized_LRouterPortNetwork, (a0,a1)),
                Request::chk(Relation::_realized_LRouterPortNetwork) => check!(_r_realized_LRouterPortNetwork),
                Request::enm(Relation::_realized_LRouterPortNetwork) => enm!(_r_realized_LRouterPortNetwork),
                Request::add(Fact::_delta_LRouterPortNetwork(a0,a1,a2)) => insert_resp!(__delta_LRouterPortNetwork, _r_delta_LRouterPortNetwork, (a0,a1,a2)),
                Request::del(Fact::_delta_LRouterPortNetwork(a0,a1,a2)) => remove_resp!(__delta_LRouterPortNetwork, _r_delta_LRouterPortNetwork, (a0,a1,a2)),
                Request::chk(Relation::_delta_LRouterPortNetwork) => check!(_r_delta_LRouterPortNetwork),
                Request::enm(Relation::_delta_LRouterPortNetwork) => enm!(_r_delta_LRouterPortNetwork),
                Request::add(Fact::_realized_LRouterLBVIP(a0,a1)) => insert_resp!(__realized_LRouterLBVIP, _r_realized_LRouterLBVIP, (a0,a1)),
                Request::del(Fact::_realized_LRouterLBVIP(a0,a1)) => remove_resp!(__realized_LRouterLBVIP, _r_realized_LRouterLBVIP, (a0,a1)),
                Request::chk(Relation::_realized_LRouterLBVIP) => check!(_r_realized_LRouterLBVIP),
                Request::enm(Relation::_realized_LRouterLBVIP) => enm!(_r_realized_LRouterLBVIP),
                Request::add(Fact::_delta_LRouterLBVIP(a0,a1,a2)) => insert_resp!(__delta_LRouterLBVIP, _r_delta_LRouterLBVIP, (a0,a1,a2)),
                Request::del(Fact::_delta_LRouterLBVIP(a0,a1,a2)) => remove_resp!(__delta_LRouterLBVIP, _r_delta_LRouterLBVIP, (a0,a1,a2)),
                Request::chk(Relation::_delta_LRouterLBVIP) => check!(_r_delta_LRouterLBVIP),
                Request::enm(Relation::_delta_LRouterLBVIP) => enm!(_r_delta_LRouterLBVIP),
                Request::add(Fact::_realized_NAT(a0,a1,a2,a3,a4,a5)) => insert_resp!(__realized_NAT, _r_realized_NAT, (a0,a1,a2,a3,a4,a5)),
                Request::del(Fact::_realized_NAT(a0,a1,a2,a3,a4,a5)) => remove_resp!(__realized_NAT, _r_realized_NAT, (a0,a1,a2,a3,a4,a5)),
                Request::chk(Relation::_realized_NAT) => check!(_r_realized_NAT),
                Request::enm(Relation::_realized_NAT) => enm!(_r_realized_NAT),
                Request::add(Fact::_delta_NAT(a0,a1,a2,a3,a4,a5,a6)) => insert_resp!(__delta_NAT, _r_delta_NAT, (a0,a1,a2,a3,a4,a5,a6)),
                Request::del(Fact::_delta_NAT(a0,a1,a2,a3,a4,a5,a6)) => remove_resp!(__delta_NAT, _r_delta_NAT, (a0,a1,a2,a3,a4,a5,a6)),
                Request::chk(Relation::_delta_NAT) => check!(_r_delta_NAT),
                Request::enm(Relation::_delta_NAT) => enm!(_r_delta_NAT),
                Request::add(Fact::_realized_LearnedAddress(a0,a1,a2)) => insert_resp!(__realized_LearnedAddress, _r_realized_LearnedAddress, (a0,a1,a2)),
                Request::del(Fact::_realized_LearnedAddress(a0,a1,a2)) => remove_resp!(__realized_LearnedAddress, _r_realized_LearnedAddress, (a0,a1,a2)),
                Request::chk(Relation::_realized_LearnedAddress) => check!(_r_realized_LearnedAddress),
                Request::enm(Relation::_realized_LearnedAddress) => enm!(_r_realized_LearnedAddress),
                Request::add(Fact::_delta_LearnedAddress(a0,a1,a2,a3)) => insert_resp!(__delta_LearnedAddress, _r_delta_LearnedAddress, (a0,a1,a2,a3)),
                Request::del(Fact::_delta_LearnedAddress(a0,a1,a2,a3)) => remove_resp!(__delta_LearnedAddress, _r_delta_LearnedAddress, (a0,a1,a2,a3)),
                Request::chk(Relation::_delta_LearnedAddress) => check!(_r_delta_LearnedAddress),
                Request::enm(Relation::_delta_LearnedAddress) => enm!(_r_delta_LearnedAddress),
                Request::add(Fact::_realized_TunnelFromTo(a0,a1,a2)) => insert_resp!(__realized_TunnelFromTo, _r_realized_TunnelFromTo, (a0,a1,a2)),
                Request::del(Fact::_realized_TunnelFromTo(a0,a1,a2)) => remove_resp!(__realized_TunnelFromTo, _r_realized_TunnelFromTo, (a0,a1,a2)),
                Request::chk(Relation::_realized_TunnelFromTo) => check!(_r_realized_TunnelFromTo),
                Request::enm(Relation::_realized_TunnelFromTo) => enm!(_r_realized_TunnelFromTo),
                Request::add(Fact::_delta_TunnelFromTo(a0,a1,a2,a3)) => insert_resp!(__delta_TunnelFromTo, _r_delta_TunnelFromTo, (a0,a1,a2,a3)),
                Request::del(Fact::_delta_TunnelFromTo(a0,a1,a2,a3)) => remove_resp!(__delta_TunnelFromTo, _r_delta_TunnelFromTo, (a0,a1,a2,a3)),
                Request::chk(Relation::_delta_TunnelFromTo) => check!(_r_delta_TunnelFromTo),
                Request::enm(Relation::_delta_TunnelFromTo) => enm!(_r_delta_TunnelFromTo),
                Request::add(Fact::_realized_TunnelPort(a0,a1,a2,a3)) => insert_resp!(__realized_TunnelPort, _r_realized_TunnelPort, (a0,a1,a2,a3)),
                Request::del(Fact::_realized_TunnelPort(a0,a1,a2,a3)) => remove_resp!(__realized_TunnelPort, _r_realized_TunnelPort, (a0,a1,a2,a3)),
                Request::chk(Relation::_realized_TunnelPort) => check!(_r_realized_TunnelPort),
                Request::enm(Relation::_realized_TunnelPort) => enm!(_r_realized_TunnelPort),
                Request::add(Fact::_delta_TunnelPort(a0,a1,a2,a3,a4)) => insert_resp!(__delta_TunnelPort, _r_delta_TunnelPort, (a0,a1,a2,a3,a4)),
                Request::del(Fact::_delta_TunnelPort(a0,a1,a2,a3,a4)) => remove_resp!(__delta_TunnelPort, _r_delta_TunnelPort, (a0,a1,a2,a3,a4)),
                Request::chk(Relation::_delta_TunnelPort) => check!(_r_delta_TunnelPort),
                Request::enm(Relation::_delta_TunnelPort) => enm!(_r_delta_TunnelPort),
                Request::add(Fact::_realized_Route(a0,a1,a2,a3,a4,a5)) => insert_resp!(__realized_Route, _r_realized_Route, (a0,a1,a2,a3,a4,a5)),
                Request::del(Fact::_realized_Route(a0,a1,a2,a3,a4,a5)) => remove_resp!(__realized_Route, _r_realized_Route, (a0,a1,a2,a3,a4,a5)),
                Request::chk(Relation::_realized_Route) => check!(_r_realized_Route),
                Request::enm(Relation::_realized_Route) => enm!(_r_realized_Route),
                Request::add(Fact::_delta_Route(a0,a1,a2,a3,a4,a5,a6)) => insert_resp!(__delta_Route, _r_delta_Route, (a0,a1,a2,a3,a4,a5,a6)),
                Request::del(Fact::_delta_Route(a0,a1,a2,a3,a4,a5,a6)) => remove_resp!(__delta_Route, _r_delta_Route, (a0,a1,a2,a3,a4,a5,a6)),
                Request::chk(Relation::_delta_Route) => check!(_r_delta_Route),
                Request::enm(Relation::_delta_Route) => enm!(_r_delta_Route),
                Request::add(Fact::_realized_LPortAtChassis(a0,a1,a2,a3)) => insert_resp!(__realized_LPortAtChassis, _r_realized_LPortAtChassis, (a0,a1,a2,a3)),
                Request::del(Fact::_realized_LPortAtChassis(a0,a1,a2,a3)) => remove_resp!(__realized_LPortAtChassis, _r_realized_LPortAtChassis, (a0,a1,a2,a3)),
                Request::chk(Relation::_realized_LPortAtChassis) => check!(_r_realized_LPortAtChassis),
                Request::enm(Relation::_realized_LPortAtChassis) => enm!(_r_realized_LPortAtChassis),
                Request::add(Fact::_delta_LPortAtChassis(a0,a1,a2,a3,a4)) => insert_resp!(__delta_LPortAtChassis, _r_delta_LPortAtChassis, (a0,a1,a2,a3,a4)),
                Request::del(Fact::_delta_LPortAtChassis(a0,a1,a2,a3,a4)) => remove_resp!(__delta_LPortAtChassis, _r_delta_LPortAtChassis, (a0,a1,a2,a3,a4)),
                Request::chk(Relation::_delta_LPortAtChassis) => check!(_r_delta_LPortAtChassis),
                Request::enm(Relation::_delta_LPortAtChassis) => enm!(_r_delta_LPortAtChassis),
                Request::add(Fact::_realized_LPortMACChassis(a0,a1,a2,a3,a4)) => insert_resp!(__realized_LPortMACChassis, _r_realized_LPortMACChassis, (a0,a1,a2,a3,a4)),
                Request::del(Fact::_realized_LPortMACChassis(a0,a1,a2,a3,a4)) => remove_resp!(__realized_LPortMACChassis, _r_realized_LPortMACChassis, (a0,a1,a2,a3,a4)),
                Request::chk(Relation::_realized_LPortMACChassis) => check!(_r_realized_LPortMACChassis),
                Request::enm(Relation::_realized_LPortMACChassis) => enm!(_r_realized_LPortMACChassis),
                Request::add(Fact::_delta_LPortMACChassis(a0,a1,a2,a3,a4,a5)) => insert_resp!(__delta_LPortMACChassis, _r_delta_LPortMACChassis, (a0,a1,a2,a3,a4,a5)),
                Request::del(Fact::_delta_LPortMACChassis(a0,a1,a2,a3,a4,a5)) => remove_resp!(__delta_LPortMACChassis, _r_delta_LPortMACChassis, (a0,a1,a2,a3,a4,a5)),
                Request::chk(Relation::_delta_LPortMACChassis) => check!(_r_delta_LPortMACChassis),
                Request::enm(Relation::_delta_LPortMACChassis) => enm!(_r_delta_LPortMACChassis),
                Request::add(Fact::_realized_LPortUnknownMACChassis(a0,a1,a2,a3)) => insert_resp!(__realized_LPortUnknownMACChassis, _r_realized_LPortUnknownMACChassis, (a0,a1,a2,a3)),
                Request::del(Fact::_realized_LPortUnknownMACChassis(a0,a1,a2,a3)) => remove_resp!(__realized_LPortUnknownMACChassis, _r_realized_LPortUnknownMACChassis, (a0,a1,a2,a3)),
                Request::chk(Relation::_realized_LPortUnknownMACChassis) => check!(_r_realized_LPortUnknownMACChassis),
                Request::enm(Relation::_realized_LPortUnknownMACChassis) => enm!(_r_realized_LPortUnknownMACChassis),
                Request::add(Fact::_delta_LPortUnknownMACChassis(a0,a1,a2,a3,a4)) => insert_resp!(__delta_LPortUnknownMACChassis, _r_delta_LPortUnknownMACChassis, (a0,a1,a2,a3,a4)),
                Request::del(Fact::_delta_LPortUnknownMACChassis(a0,a1,a2,a3,a4)) => remove_resp!(__delta_LPortUnknownMACChassis, _r_delta_LPortUnknownMACChassis, (a0,a1,a2,a3,a4)),
                Request::chk(Relation::_delta_LPortUnknownMACChassis) => check!(_r_delta_LPortUnknownMACChassis),
                Request::enm(Relation::_delta_LPortUnknownMACChassis) => enm!(_r_delta_LPortUnknownMACChassis),
                Request::add(Fact::_realized_LPortLB(a0)) => insert_resp!(__realized_LPortLB, _r_realized_LPortLB, a0),
                Request::del(Fact::_realized_LPortLB(a0)) => remove_resp!(__realized_LPortLB, _r_realized_LPortLB, a0),
                Request::chk(Relation::_realized_LPortLB) => check!(_r_realized_LPortLB),
                Request::enm(Relation::_realized_LPortLB) => enm!(_r_realized_LPortLB),
                Request::add(Fact::_delta_LPortLB(a0,a1)) => insert_resp!(__delta_LPortLB, _r_delta_LPortLB, (a0,a1)),
                Request::del(Fact::_delta_LPortLB(a0,a1)) => remove_resp!(__delta_LPortLB, _r_delta_LPortLB, (a0,a1)),
                Request::chk(Relation::_delta_LPortLB) => check!(_r_delta_LPortLB),
                Request::enm(Relation::_delta_LPortLB) => enm!(_r_delta_LPortLB),
                Request::add(Fact::_realized_Chassis(a0,a1,a2,a3)) => insert_resp!(__realized_Chassis, _r_realized_Chassis, (a0,a1,a2,a3)),
                Request::del(Fact::_realized_Chassis(a0,a1,a2,a3)) => remove_resp!(__realized_Chassis, _r_realized_Chassis, (a0,a1,a2,a3)),
                Request::chk(Relation::_realized_Chassis) => check!(_r_realized_Chassis),
                Request::enm(Relation::_realized_Chassis) => enm!(_r_realized_Chassis),
                Request::add(Fact::_delta_Chassis(a0,a1,a2,a3,a4)) => insert_resp!(__delta_Chassis, _r_delta_Chassis, (a0,a1,a2,a3,a4)),
                Request::del(Fact::_delta_Chassis(a0,a1,a2,a3,a4)) => remove_resp!(__delta_Chassis, _r_delta_Chassis, (a0,a1,a2,a3,a4)),
                Request::chk(Relation::_delta_Chassis) => check!(_r_delta_Chassis),
                Request::enm(Relation::_delta_Chassis) => enm!(_r_delta_Chassis),

            };
        };
    }).unwrap();
}